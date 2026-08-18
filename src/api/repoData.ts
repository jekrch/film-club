/**
 * The live copies of the editable JSON files, read straight from the repo.
 *
 * Four of these used to be worker endpoints (`GET /api/overrides`, `/api/lists`,
 * `/api/watched`, `/api/club`), which read `main` through the GitHub API and
 * spent a Workers request each time. They don't need to: the repository is
 * public, so `raw.githubusercontent.com` serves the same bytes to an
 * unauthenticated `fetch` with `access-control-allow-origin: *`, for free and
 * without a round trip through Cloudflare.
 *
 * What is *not* free is freshness. Raw serves `cache-control: max-age=300`, so
 * a file fetched here can be up to five minutes behind `main` — where the
 * worker was always current. That would have undone the guarantee those
 * endpoints existed for (§8.8: never show a member a save that hasn't deployed
 * yet), so it is bought back a different way: every write already returns the
 * stored record, and `writeCache.ts` keeps this tab's own results to overlay
 * onto whatever the CDN hands back. The reads below apply that overlay, so a
 * caller sees the file as of `main` *or* better, never worse.
 *
 * The two endpoints that remain on the worker are the two that can't move:
 * `/api/session` verifies a Google token against a secret, and
 * `/api/films/search` keeps the OMDB key server-side.
 */

import { DATA_BRANCH, DATA_REPO } from '../config/editorEnv';
import type { FilmListDefinition } from '../types/list';
import type { TeamMember } from '../types/team';
import type { TrophiesFile, Trophy } from '../types/trophy';
import type { WatchedEntry, WatchedLog } from '../types/watched';
import { compareTrophies } from '../utils/trophyUtils';
import { compareWatched } from '../utils/watchedUtils';
import type { FilmRecordPatch, OverridesFile, RatingOverride } from './clubApi';
import { pendingWrites, reconcile, splitKey } from './writeCache';

const RAW_BASE = `https://raw.githubusercontent.com/${DATA_REPO}/${DATA_BRANCH}/src/assets`;

/**
 * One file, parsed.
 *
 * `cache: 'no-cache'` does not bypass GitHub's CDN — nothing a browser sends
 * can — but it does stop the *browser* from answering out of a copy older than
 * the edge's, which is otherwise exactly what `max-age=300` invites on a second
 * page view. The revalidation is an ETag round trip and usually a 304.
 */
async function fetchAsset<T>(file: string, signal?: AbortSignal): Promise<T> {
    let response: Response;
    try {
        response = await fetch(`${RAW_BASE}/${file}`, { signal, cache: 'no-cache' });
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        throw new Error("Couldn't reach GitHub to load the latest saves.");
    }

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

/** `watched.json` — every member's personal log, keyed by display name. */
export async function fetchWatched(signal?: AbortSignal): Promise<WatchedLog> {
    const file = await fetchAsset<WatchedLog>('watched.json', signal);
    const log: WatchedLog = { ...(file ?? {}) };

    const pending = pendingWrites<WatchedEntry>('watched');
    const source = new Map<string, unknown>();

    for (const [key, value] of pending) {
        const { imdbId, owner } = splitKey(key);
        // The file keys by display name ("Jacob"); the cache keys by the
        // lowercased one, since that is all a caller reliably has.
        const name = Object.keys(log).find((k) => k.trim().toLowerCase() === owner);
        const entries = name === undefined ? [] : log[name];

        source.set(key, entries.find((entry) => entry.imdbID === imdbId) ?? null);

        const without = entries.filter((entry) => entry.imdbID !== imdbId);
        const next = (value ? [...without, value] : without).sort(compareWatched);
        log[name ?? owner] = next;
    }

    reconcile('watched', source);
    return log;
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
