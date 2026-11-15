/**
 * The live copies of the editable JSON files, as the latest deploy published them.
 *
 * Every deploy copies these files to `/data/` on the site's own origin
 * (`liveData` in `vite.config.ts`). The bundle holds them too, but a visitor's
 * bundle can be a deploy behind while the service worker swaps it out. These
 * reads are how a page catches up without waiting for that.
 *
 * The watch logs are the exception: they aren't bundled at all, and these reads
 * are the only way the site sees them. A watch-log commit is published within a
 * minute or so by `data-deploy.yml`, without a build.
 *
 * A deploy lands a minute or two after the commit, longer for a burst of
 * reactions (see `deploy.yml`). So a member never sees a stale copy of their
 * own save, every write returns the stored record and `writeCache.ts` keeps this
 * tab's results. The reads below overlay those onto the fetched file, so a
 * caller sees the deployed copy or newer.
 */

import { DATA_BASE } from '../config/editorEnv';
import type { FilmListDefinition } from '../types/list';
import type { TeamMember } from '../types/team';
import type { ResponseComment, ResponseThread, ResponsesFile } from '../types/responses';
import type { TrophiesFile, Trophy } from '../types/trophy';
import {
    assertWatchedEntries,
    memberSlug,
    type WatchedEntry,
    type WatchedLog,
} from '../types/watched';
import { compareTrophies } from '../utils/trophyUtils';
import { compareWatched } from '../utils/watchedUtils';
import type { FilmRecordPatch, OverridesFile, RatingOverride } from './clubApi';
import { pendingWrites, reconcile, splitKey, splitTupleKey } from './writeCache';

/**
 * One file, parsed.
 *
 * `cache: 'no-cache'` stops the browser from answering out of its own copy,
 * which GitHub Pages' `max-age=600` otherwise invites on a second page view.
 * The revalidation is an ETag round trip and usually a 304.
 */
async function fetchAsset<T>(
    file: string,
    signal?: AbortSignal,
    options: { missing?: T } = {}
): Promise<T> {
    let response: Response;
    try {
        response = await fetch(`${DATA_BASE}/${file}`, { signal, cache: 'no-cache' });
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        throw new Error("Couldn't load the latest saves.");
    }

    if (response.status === 404 && options.missing !== undefined) return options.missing;
    if (!response.ok) {
        throw new Error(`Couldn't load ${file} (${response.status}).`);
    }

    try {
        return (await response.json()) as T;
    } catch {
        throw new Error(`${file} came back unreadable.`);
    }
}

/**
 * `overrides.json` — everything members have edited about a club film: their own
 * scores and reviews, keyed by lowercased member name, and the film's own club
 * record beside them.
 *
 * Two overlays rather than one, on two independent write kinds, because the two
 * halves of a film's record have different writers: an admin filling in scores
 * and a member fixing the cover must not overwrite each other's pending state
 * just because their saves landed on the same film.
 */
export async function fetchOverrides(signal?: AbortSignal): Promise<OverridesFile> {
    const file = await fetchAsset<OverridesFile>('overrides.json', signal);
    const films = file.films ?? {};

    const pendingRatings = pendingWrites<RatingOverride>('rating');
    const ratingSource = new Map<string, unknown>();

    for (const [key, value] of pendingRatings) {
        const { imdbId, owner } = splitKey(key);
        ratingSource.set(key, films[imdbId]?.ratings?.[owner] ?? null);

        const ratings = { ...(films[imdbId]?.ratings ?? {}) };
        if (value) ratings[owner] = value;
        else delete ratings[owner];
        films[imdbId] = { ...films[imdbId], ratings };
    }

    reconcile('rating', ratingSource);

    const pendingFilms = pendingWrites<FilmRecordPatch>('film');
    const filmSource = new Map<string, unknown>();

    for (const [imdbId, value] of pendingFilms) {
        const stored = films[imdbId];
        // Compared on the pair rather than on `film` alone: a film added here
        // and one merely edited differ only by the `added` marker, and the
        // entry has to clear once the CDN is serving both.
        filmSource.set(
            imdbId,
            stored?.film || stored?.added ? { film: stored.film, added: stored.added } : null
        );

        // The ratings stay whatever the fetch (and the overlay above) made them:
        // this write knew nothing about them.
        const ratings = films[imdbId]?.ratings ?? {};
        if (value) films[imdbId] = { ...value, ratings };
        else if (stored) films[imdbId] = { ratings };
    }

    reconcile('film', filmSource);
    return { films };
}

/** `lists.json` — every member list, as an array. */
export async function fetchLists(signal?: AbortSignal): Promise<FilmListDefinition[]> {
    const file = await fetchAsset<FilmListDefinition[]>('lists.json', signal);
    const lists = Array.isArray(file) ? [...file] : [];

    const pending = pendingWrites<FilmListDefinition>('list');
    const source = new Map<string, unknown>();

    for (const [id, value] of pending) {
        const at = lists.findIndex((list) => list.id === id);
        source.set(id, at === -1 ? null : lists[at]);

        // A list created a moment ago is absent rather than stale, which is the
        // case the editor's "not found" branch would otherwise get wrong.
        if (value === null) {
            if (at !== -1) lists.splice(at, 1);
        } else if (at === -1) {
            lists.push(value);
        } else {
            lists[at] = value;
        }
    }

    reconcile('list', source);
    return lists;
}

/**
 * The named members' watch logs as published, keyed by the names given, with
 * nothing overlaid. Each is its own file (`watched/<slug>.json`), fetched in
 * parallel.
 *
 * Every club member has a file on the site, an empty one if they've never
 * logged anything (`liveDataFiles` in `scripts/liveData.ts`). A 404 still
 * reads as an empty log rather than an error, since a member added to
 * `club.json` has no file until the next deploy.
 */
export async function fetchWatchedFiles(
    owners: readonly string[],
    signal?: AbortSignal
): Promise<WatchedLog> {
    const files = await Promise.all(
        owners.map(async (owner) => {
            const file = `watched/${memberSlug(owner)}.json`;
            const data = await fetchAsset<unknown>(file, signal, { missing: [] });
            return [owner, assertWatchedEntries(data, file)] as const;
        })
    );
    return Object.fromEntries(files);
}

/**
 * The named members' watch logs, with this tab's unconfirmed saves laid over
 * them. Most pages want `useWatchedLog`, which calls this and remembers the
 * result across navigations.
 */
export async function fetchWatched(
    owners: readonly string[],
    signal?: AbortSignal
): Promise<WatchedLog> {
    const files = await fetchWatchedFiles(owners, signal);
    const { log, source } = overlayPendingWatched(files, owners);
    reconcile('watched', source);
    return log;
}

/**
 * A watch log with this tab's unconfirmed saves laid over it, and what `file`
 * itself says for each of them — the second half is what {@link reconcile}
 * needs, and only a fresh fetch should hand it that.
 *
 * `owners` limits both halves to the members `file` actually holds. A pending
 * save for anyone else is left alone: laying it over a log this page never
 * fetched would invent that log, and reporting it to {@link reconcile} as
 * absent would clear a pending delete before it had landed.
 */
export function overlayPendingWatched(
    file: WatchedLog,
    owners: readonly string[]
): {
    log: WatchedLog;
    source: Map<string, unknown>;
} {
    const log: WatchedLog = { ...file };
    const wanted = new Set(owners.map((owner) => owner.trim().toLowerCase()));

    const pending = pendingWrites<WatchedEntry>('watched');
    const source = new Map<string, unknown>();

    for (const [key, value] of pending) {
        const { imdbId, owner } = splitKey(key);
        if (!wanted.has(owner)) continue;
        // The file keys by display name ("Jacob"); the cache keys by the
        // lowercased one, since that is all a caller reliably has.
        const name = Object.keys(log).find((k) => k.trim().toLowerCase() === owner);
        const entries = name === undefined ? [] : log[name];

        source.set(key, entries.find((entry) => entry.imdbID === imdbId) ?? null);

        const without = entries.filter((entry) => entry.imdbID !== imdbId);
        const next = (value ? [...without, value] : without).sort(compareWatched);
        log[name ?? owner] = next;
    }

    return { log, source };
}

/**
 * `trophies.json` — every award the club has given on the site, keyed by film.
 *
 * The overlay is per-award rather than per-film: two members can hand out
 * trophies on the same film in the same minute, and replacing the film's whole
 * array with this tab's copy would drop the other's.
 */
export async function fetchTrophies(signal?: AbortSignal): Promise<Record<string, Trophy[]>> {
    const file = await fetchAsset<TrophiesFile>('trophies.json', signal);
    const films = { ...(file?.films ?? {}) };

    const pending = pendingWrites<Trophy>('trophy');
    const source = new Map<string, unknown>();

    for (const [key, value] of pending) {
        const { imdbId, owner: id } = splitKey(key);
        const trophies = films[imdbId] ?? [];

        source.set(key, trophies.find((trophy) => trophy.id === id) ?? null);

        const without = trophies.filter((trophy) => trophy.id !== id);
        const next = value ? [...without, value].sort(compareTrophies) : without;
        // Keep the film key only while it has awards, so the overlaid shape
        // matches what the worker commits.
        if (next.length === 0) delete films[imdbId];
        else films[imdbId] = next;
    }

    reconcile('trophy', source);
    return films;
}

/** `club.json` — every member's profile record. */
export async function fetchClub(signal?: AbortSignal): Promise<TeamMember[]> {
    const file = await fetchAsset<TeamMember[]>('club.json', signal);
    const club = Array.isArray(file) ? [...file] : [];

    const pending = pendingWrites<TeamMember>('profile');
    const source = new Map<string, unknown>();

    for (const [name, value] of pending) {
        const at = club.findIndex((entry) => entry.name.toLowerCase() === name);
        source.set(name, at === -1 ? null : club[at]);
        // The worker cannot create or delete a member, so an unknown name here
        // is a stale key rather than a row to add.
        if (value !== null && at !== -1) club[at] = value;
    }

    reconcile('profile', source);
    return club;
}

/** Oldest first, ties on id, so an overlaid comment lands where the worker would put it. */
const compareComments = (a: ResponseComment, b: ResponseComment): number =>
    a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt);

/**
 * Lays this tab's pending reactions and comments over a copy of the threads.
 *
 * Idempotent, so it is safe to run over threads it has already been run over.
 * `ResponsesContext` relies on that: it re-applies the overlay after every
 * write so a reaction still in flight doesn't flicker off when an earlier one
 * comes back with the server's copy of the thread.
 *
 * `source`, when given, is filled with what the threads themselves say for each
 * pending key, which is what {@link reconcile} needs. It has to be read before
 * the overlay changes anything.
 */
export function overlayResponses(
    threads: Record<string, ResponseThread>,
    source?: { reaction: Map<string, unknown>; comment: Map<string, unknown> }
): Record<string, ResponseThread> {
    const next = { ...threads };
    const thread = (id: string): ResponseThread => next[id] ?? { reactions: {}, comments: [] };

    for (const [key, value] of pendingWrites<true>('reaction')) {
        const parts = splitTupleKey(key);
        if (!parts || parts.length !== 3) continue;
        const [threadId, reaction, member] = parts as [
            string,
            keyof ResponseThread['reactions'],
            string,
        ];

        const current = thread(threadId);
        const who = current.reactions[reaction] ?? [];
        const has = who.some((name) => name.toLowerCase() === member.toLowerCase());
        source?.reaction.set(key, has ? true : null);

        if (Boolean(value) === has) continue;
        const reactions = { ...current.reactions };
        const updated = value
            ? [...who, member]
            : who.filter((name) => name.toLowerCase() !== member.toLowerCase());
        if (updated.length === 0) delete reactions[reaction];
        else reactions[reaction] = updated;
        next[threadId] = { ...current, reactions };
    }

    for (const [key, value] of pendingWrites<ResponseComment>('comment')) {
        const parts = splitTupleKey(key);
        if (!parts || parts.length !== 2) continue;
        const [threadId, id] = parts;

        const current = thread(threadId);
        source?.comment.set(key, current.comments.find((comment) => comment.id === id) ?? null);

        const without = current.comments.filter((comment) => comment.id !== id);
        const comments = value ? [...without, value].sort(compareComments) : without;
        next[threadId] = { ...current, comments };
    }

    // The worker stores an emptied thread as no thread at all; match it, so a
    // reader can test for presence.
    for (const [id, value] of Object.entries(next)) {
        if (Object.keys(value.reactions).length === 0 && value.comments.length === 0) {
            delete next[id];
        }
    }
    return next;
}

/**
 * `responses.json`: reactions and comments on log entries, keyed by thread.
 *
 * Unlike the other files here this one is read for signed-out visitors too.
 * Its commits deploy only after a quiet spell (see `DEFER_DEPLOY` in the
 * worker), so a page that has been open a while can be several reactions behind
 * its bundle, and this read is how it catches up.
 */
export async function fetchResponses(
    signal?: AbortSignal
): Promise<Record<string, ResponseThread>> {
    const file = await fetchAsset<ResponsesFile>('responses.json', signal);
    const threads: Record<string, ResponseThread> = {};
    for (const [id, thread] of Object.entries(file?.threads ?? {})) {
        threads[id] = { reactions: thread?.reactions ?? {}, comments: thread?.comments ?? [] };
    }

    const source = { reaction: new Map<string, unknown>(), comment: new Map<string, unknown>() };
    const overlaid = overlayResponses(threads, source);
    reconcile('reaction', source.reaction);
    reconcile('comment', source.comment);
    return overlaid;
}
