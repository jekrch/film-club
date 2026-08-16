/**
 * The film-club editing worker: auth → validate → commit.
 *
 * Members sign in to the site with Google and edit their own contributions;
 * this worker verifies who they are, checks the payload against §8.3's trust
 * boundary, and commits the result to the repo. The site itself stays fully
 * static — nothing on a normal page load talks to this worker, and a save is
 * live once the Pages build that the commit triggers finishes, about a minute.
 *
 * Three files, one writer each (§8.1): `overrides.json` for scores and reviews
 * on club films, `lists.json` for member lists, `watched.json` for what members
 * watched on their own. CI owns `films.json` and `listFilms.json` and this
 * worker never touches them.
 */

import { authenticate, memberNames } from './auth';
import { HttpError, badRequest, forbidden, notFound } from './errors';
import {
    LISTS_PATH,
    OVERRIDES_PATH,
    WATCHED_PATH,
    commitJson,
    fetchClubFilmIds,
    readJson,
    type CommitPlan,
} from './github';
import { searchFilms } from './omdb';
import type {
    Env,
    FilmListDefinition,
    Member,
    OverridesFile,
    RatingOverride,
    WatchedEntry,
    WatchedLog,
} from './types';
import {
    LIMITS,
    assignListId,
    resolveListOwner,
    resolveOwner,
    validateImdbId,
    validateListInput,
    validateRatingPatch,
    validateWatchedPatch,
    type RatingPatch,
    type WatchedPatch,
} from './validate';

const EMPTY_OVERRIDES: OverridesFile = { films: {} };
const EMPTY_LISTS: FilmListDefinition[] = [];
const EMPTY_WATCHED: WatchedLog = {};

/**
 * Commit timestamps drop milliseconds to match the `2026-08-12T19:04:11Z` form
 * used elsewhere in the data files.
 */
function timestamp(): string {
    return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Today in UTC, the default watch date for a film logged without one. */
function today(): string {
    return new Date().toISOString().slice(0, 10);
}

// --- CORS ---------------------------------------------------------------

/**
 * `ALLOWED_ORIGIN` is a comma-separated list so localhost and production can
 * share one deployment. The header is echoed only for an exact match — never
 * `*`, since these requests carry a credential.
 */
function corsHeaders(request: Request, env: Env): Record<string, string> {
    const origin = request.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);

    const headers: Record<string, string> = {
        Vary: 'Origin',
        'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Max-Age': '86400',
    };
    if (origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
    return headers;
}

function json(data: unknown, status: number, cors: Record<string, string>): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...cors },
    });
}

// --- Request helpers ----------------------------------------------------

/**
 * Parses the body, refusing anything over the §8.3 size cap *before* parsing it.
 * `Content-Length` is a hint the client controls, so the real check is on the
 * bytes that actually arrived.
 */
async function readBody(request: Request): Promise<unknown> {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > LIMITS.body) {
        throw badRequest(`Request body exceeds the ${LIMITS.body / 1024} KB limit.`);
    }
    if (!text.trim()) throw badRequest('Expected a JSON body.');
    try {
        return JSON.parse(text);
    } catch {
        throw badRequest('Body is not valid JSON.');
    }
}

// --- Handlers -----------------------------------------------------------

/**
 * Applies a validated patch to the caller's rating override.
 *
 * Field-level merge, not replace: only the keys the body carried are touched,
 * so saving a blurb leaves the score alone. `updatedBy`/`updatedAt` are
 * provenance for humans reading the file — `apply_overrides.py` whitelists the
 * three real fields and never copies these into `films.json`.
 */
function mergeRating(existing: RatingOverride | undefined, patch: RatingPatch, member: Member): RatingOverride {
    return { ...existing, ...patch, updatedBy: member.name, updatedAt: timestamp() };
}

/** True when the patch would leave the stored override's real fields unchanged. */
function ratingUnchanged(existing: RatingOverride | undefined, patch: RatingPatch): boolean {
    if (!existing) return false;
    return (Object.keys(patch) as Array<keyof RatingPatch>).every(
        (field) => field in existing && existing[field] === patch[field]
    );
}

async function putRating(
    request: Request,
    env: Env,
    member: Member,
    imdbId: string
): Promise<unknown> {
    const patch = validateRatingPatch(await readBody(request));

    // The worker cannot create films; that stays the sheet's job. Checked
    // against the live films.json rather than anything the client sent.
    const clubFilmIds = await fetchClubFilmIds(env);
    if (!clubFilmIds.has(imdbId)) {
        throw notFound(`${imdbId} isn't a club film. Films are added through the Google Sheet.`);
    }

    const user = member.name.toLowerCase();

    return commitJson<OverridesFile, unknown>(
        env,
        OVERRIDES_PATH,
        EMPTY_OVERRIDES,
        (current): CommitPlan<OverridesFile, unknown> => {
            const films = { ...(current.films ?? {}) };
            const film = films[imdbId] ?? { ratings: {} };
            const existing = film.ratings[user];

            if (ratingUnchanged(existing, patch)) {
                return { commit: false, result: { imdbID: imdbId, rating: existing, changed: false } };
            }

            const rating = mergeRating(existing, patch, member);
            films[imdbId] = { ...film, ratings: { ...film.ratings, [user]: rating } };

            return {
                commit: true,
                next: { ...current, films },
                message: `Update rating: ${member.name} on ${imdbId}`,
                result: { imdbID: imdbId, rating, changed: true },
            };
        }
    );
}

/**
 * Drops the override and hands the row back to the sheet.
 *
 * This is the revert action behind the film page's "edited on the site" marker.
 * It removes the member's key entirely rather than nulling its fields, because
 * a `null` is itself an override meaning "deliberately blank" (§8.7).
 */
async function deleteRating(env: Env, member: Member, imdbId: string): Promise<unknown> {
    const user = member.name.toLowerCase();

    return commitJson<OverridesFile, unknown>(
        env,
        OVERRIDES_PATH,
        EMPTY_OVERRIDES,
        (current): CommitPlan<OverridesFile, unknown> => {
            const film = current.films?.[imdbId];
            if (!film?.ratings?.[user]) {
                throw notFound(`No override to revert for ${member.name} on ${imdbId}.`);
            }

            const ratings = { ...film.ratings };
            delete ratings[user];

            const films = { ...current.films };
            // Drop the film key too once its last override is gone, so the file
            // doesn't accumulate empty shells.
            if (Object.keys(ratings).length === 0) delete films[imdbId];
            else films[imdbId] = { ...film, ratings };

            return {
                commit: true,
                next: { ...current, films },
                message: `Revert rating: ${member.name} on ${imdbId}`,
                result: { imdbID: imdbId, reverted: true },
            };
        }
    );
}

// --- Watch log ----------------------------------------------------------

/**
 * Newest watch first, which is the order the site renders and therefore the
 * order the file is stored in — a member reading the raw JSON sees their log
 * the same way round as their page.
 *
 * Ties break on `imdbID` so the sort is total: two films watched the same day
 * must not swap places from one save to the next, or every commit would show a
 * reordering that isn't a change.
 */
function sortWatched(entries: WatchedEntry[]): WatchedEntry[] {
    return [...entries].sort((a, b) =>
        a.watchDate === b.watchDate
            ? a.imdbID.localeCompare(b.imdbID)
            : b.watchDate.localeCompare(a.watchDate)
    );
}

/** Rebuilds the log with member keys in a stable order, so diffs stay local. */
function sortedLog(log: WatchedLog): WatchedLog {
    const next: WatchedLog = {};
    for (const owner of Object.keys(log).sort()) next[owner] = log[owner];
    return next;
}

/** The stored fields, minus the `updatedAt` provenance a no-op save shouldn't touch. */
function watchedUnchanged(existing: WatchedEntry | undefined, next: WatchedEntry): boolean {
    return (
        existing !== undefined &&
        existing.watchDate === next.watchDate &&
        existing.score === next.score &&
        existing.scoreQualifier === next.scoreQualifier &&
        existing.blurb === next.blurb &&
        existing.image === next.image &&
        existing.posterImage === next.posterImage
    );
}

/**
 * Logs a film as watched, or edits an entry already logged.
 *
 * One entry per film per member: a rewatch moves the existing entry's date
 * rather than adding a second row, which is what keeps the log keyed by
 * `imdbID` and the URL `PUT /api/watched/:imdbId` meaningful.
 *
 * There is deliberately **no** club-film check here, unlike `PUT …/rating`. The
 * whole point of the log is films the club never watched, and a member may also
 * log one it did — that entry's score is theirs alone and never reaches
 * `films.json`, because nothing in CI reads this file into club data.
 */
async function putWatched(
    request: Request,
    env: Env,
    member: Member,
    imdbId: string
): Promise<unknown> {
    const body = await readBody(request);
    const patch: WatchedPatch = validateWatchedPatch(body);
    const owner = resolveOwner((body as Record<string, unknown>).owner, member, memberNames(env));

    return commitJson<WatchedLog, unknown>(
        env,
        WATCHED_PATH,
        EMPTY_WATCHED,
        (current): CommitPlan<WatchedLog, unknown> => {
            const entries = [...(current[owner] ?? [])];
            const index = entries.findIndex((entry) => entry.imdbID === imdbId);
            const existing = index === -1 ? undefined : entries[index];

            if (existing === undefined && entries.length >= LIMITS.watched) {
                throw badRequest(`A watch log holds at most ${LIMITS.watched} films.`);
            }

            // A field the body didn't carry keeps what was stored; on a first
            // log there is nothing stored, so it starts blank — except the date,
            // which defaults to today so "I watched this" is a one-field save.
            const next: WatchedEntry = {
                imdbID: imdbId,
                watchDate: patch.watchDate ?? existing?.watchDate ?? today(),
                score: 'score' in patch ? (patch.score ?? null) : (existing?.score ?? null),
                scoreQualifier:
                    'scoreQualifier' in patch
                        ? (patch.scoreQualifier ?? null)
                        : (existing?.scoreQualifier ?? null),
                blurb: 'blurb' in patch ? (patch.blurb ?? null) : (existing?.blurb ?? null),
                image: 'image' in patch ? (patch.image ?? null) : (existing?.image ?? null),
                posterImage:
                    'posterImage' in patch
                        ? (patch.posterImage ?? null)
                        : (existing?.posterImage ?? null),
                updatedAt: timestamp(),
            };

            if (watchedUnchanged(existing, next)) {
                return { commit: false, result: { entry: existing, created: false, changed: false } };
            }

            if (index === -1) entries.push(next);
            else entries[index] = next;

            return {
                commit: true,
                next: sortedLog({ ...current, [owner]: sortWatched(entries) }),
                message: `${existing ? 'Update' : 'Log'} watched: ${owner} on ${imdbId}`,
                result: { entry: next, created: index === -1, changed: true },
            };
        }
    );
}

/** Removes one film from a member's log entirely — score, review, and date with it. */
async function deleteWatched(
    env: Env,
    member: Member,
    imdbId: string,
    requestedOwner: string | null
): Promise<unknown> {
    const owner = resolveOwner(requestedOwner, member, memberNames(env));

    return commitJson<WatchedLog, unknown>(
        env,
        WATCHED_PATH,
        EMPTY_WATCHED,
        (current): CommitPlan<WatchedLog, unknown> => {
            const entries = current[owner] ?? [];
            if (!entries.some((entry) => entry.imdbID === imdbId)) {
                throw notFound(`${owner} hasn't logged ${imdbId} as watched.`);
            }

            const remaining = entries.filter((entry) => entry.imdbID !== imdbId);
            const log = { ...current };
            // Drop the member key with their last entry, so the file doesn't
            // accumulate empty logs for people who cleared theirs.
            if (remaining.length === 0) delete log[owner];
            else log[owner] = remaining;

            return {
                commit: true,
                next: sortedLog(log),
                message: `Remove watched: ${owner} on ${imdbId}`,
                result: { imdbID: imdbId, owner, deleted: true },
            };
        }
    );
}

/**
 * Creates or replaces one list.
 *
 * The id in the path is only a lookup key. On create the worker assigns the id
 * itself (§8.3) and returns it — so a rename later changes the name and leaves
 * the URL alone, which is why the id can't be derived from the name at render
 * time. Clients that are creating should PUT to `/api/lists/new`; any unmatched
 * id behaves the same way.
 */
async function putList(request: Request, env: Env, member: Member, pathId: string): Promise<unknown> {
    const body = await readBody(request);
    const input = validateListInput(body);
    // Resolved per branch rather than up front: on an update, an absent `owner`
    // has to mean the stored owner, which isn't known until the file is read.
    const requestedOwner = (body as Record<string, unknown>).owner;
    const names = memberNames(env);

    return commitJson<FilmListDefinition[], unknown>(
        env,
        LISTS_PATH,
        EMPTY_LISTS,
        (current): CommitPlan<FilmListDefinition[], unknown> => {
            const lists = [...current];
            const index = lists.findIndex((list) => list.id === pathId);

            if (index === -1) {
                const owner = resolveListOwner(requestedOwner, member, names, null);
                const created: FilmListDefinition = {
                    id: assignListId(owner, input.name, lists.map((list) => list.id)),
                    name: input.name,
                    owner,
                    description: input.description,
                    ranked: input.ranked,
                    entries: input.entries,
                };
                // Creation order — the frontend renders lists in file order.
                lists.push(created);
                return {
                    commit: true,
                    next: lists,
                    message: `Add list: ${owner} — ${created.name}`,
                    result: { list: created, created: true },
                };
            }

            const existing = lists[index];
            if (existing.owner.toLowerCase() !== member.name.toLowerCase() && !member.admin) {
                throw forbidden(`"${existing.name}" belongs to ${existing.owner}.`);
            }

            // Defers to the stored owner when the body names nobody. An admin
            // editing someone else's list is routine and sends no `owner`, so
            // taking the caller's name here would reassign the list to them.
            const owner = resolveListOwner(requestedOwner, member, names, existing.owner);

            const updated: FilmListDefinition = {
                // Immutable: the id survives a rename, and an owner change is a
                // deliberate admin action rather than a side effect of the body.
                id: existing.id,
                name: input.name,
                owner,
                description: input.description,
                ranked: input.ranked,
                entries: input.entries,
            };
            lists[index] = updated;

            if (JSON.stringify(existing) === JSON.stringify(updated)) {
                return { commit: false, result: { list: updated, created: false, changed: false } };
            }

            return {
                commit: true,
                next: lists,
                message: `Update list: ${owner} — ${updated.name}`,
                result: { list: updated, created: false, changed: true },
            };
        }
    );
}

async function deleteList(env: Env, member: Member, listId: string): Promise<unknown> {
    return commitJson<FilmListDefinition[], unknown>(
        env,
        LISTS_PATH,
        EMPTY_LISTS,
        (current): CommitPlan<FilmListDefinition[], unknown> => {
            const index = current.findIndex((list) => list.id === listId);
            if (index === -1) throw notFound(`No list with id "${listId}".`);

            const target = current[index];
            if (target.owner.toLowerCase() !== member.name.toLowerCase() && !member.admin) {
                throw forbidden(`"${target.name}" belongs to ${target.owner}.`);
            }

            const lists = current.filter((_, i) => i !== index);
            return {
                commit: true,
                next: lists,
                message: `Delete list: ${target.owner} — ${target.name}`,
                result: { id: listId, deleted: true },
            };
        }
    );
}

// --- Routing ------------------------------------------------------------

/**
 * Resolves one request to a response body.
 *
 * Every route authenticates first — there is no unauthenticated surface here
 * beyond the CORS preflight. The reads exist so the editor sees a save that
 * hasn't deployed yet: they come from `main`, not from the bundle the browser
 * loaded (§8.8).
 */
async function route(request: Request, env: Env): Promise<unknown> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');
    const method = request.method;

    const member = await authenticate(request, env);

    if (path === '/api/session' && method === 'GET') {
        return { member: member.name, admin: member.admin };
    }

    if (path === '/api/overrides' && method === 'GET') {
        const { data } = await readJson<OverridesFile>(env, OVERRIDES_PATH);
        return data ?? EMPTY_OVERRIDES;
    }

    if (path === '/api/lists' && method === 'GET') {
        const { data } = await readJson<FilmListDefinition[]>(env, LISTS_PATH);
        return { lists: data ?? EMPTY_LISTS };
    }

    if (path === '/api/watched' && method === 'GET') {
        const { data } = await readJson<WatchedLog>(env, WATCHED_PATH);
        return { watched: data ?? EMPTY_WATCHED };
    }

    if (path === '/api/films/search' && method === 'GET') {
        const query = (url.searchParams.get('q') ?? '').trim();
        if (query.length < 2) throw badRequest('Search needs at least two characters.');
        return { results: await searchFilms(env, query) };
    }

    const ratingMatch = /^\/api\/films\/([^/]+)\/rating$/.exec(path);
    if (ratingMatch) {
        const imdbId = validateImdbId(decodeURIComponent(ratingMatch[1]), 'imdbId');
        if (method === 'PUT') return putRating(request, env, member, imdbId);
        if (method === 'DELETE') return deleteRating(env, member, imdbId);
        throw new HttpError(405, `${method} not allowed on ${path}.`);
    }

    const watchedMatch = /^\/api\/watched\/([^/]+)$/.exec(path);
    if (watchedMatch) {
        const imdbId = validateImdbId(decodeURIComponent(watchedMatch[1]), 'imdbId');
        if (method === 'PUT') return putWatched(request, env, member, imdbId);
        // The owner rides in the query rather than a body: DELETE bodies are
        // poorly supported by intermediaries, and an admin acting for someone
        // else still has to name them.
        if (method === 'DELETE') {
            return deleteWatched(env, member, imdbId, url.searchParams.get('owner'));
        }
        throw new HttpError(405, `${method} not allowed on ${path}.`);
    }

    const listMatch = /^\/api\/lists\/([^/]+)$/.exec(path);
    if (listMatch) {
        const listId = decodeURIComponent(listMatch[1]);
        if (method === 'PUT') return putList(request, env, member, listId);
        if (method === 'DELETE') return deleteList(env, member, listId);
        throw new HttpError(405, `${method} not allowed on ${path}.`);
    }

    throw notFound(`No route for ${method} ${path}.`);
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const cors = corsHeaders(request, env);

        if (request.method === 'OPTIONS') {
            // The preflight is unauthenticated by definition — browsers never
            // send the Authorization header on it.
            return new Response(null, { status: 204, headers: cors });
        }

        try {
            return json(await route(request, env), 200, cors);
        } catch (err) {
            if (err instanceof HttpError) {
                return json({ error: err.message }, err.status, cors);
            }
            // Anything else is a bug. Log it for `wrangler tail` and tell the
            // browser nothing that could leak repo, token, or path detail.
            console.error('Unhandled worker error:', err);
            return json({ error: 'Something went wrong saving that.' }, 500, cors);
        }
    },
};
