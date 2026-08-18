/**
 * The film-club editing worker: auth → validate → commit.
 *
 * Members sign in to the site with Google and edit their own contributions;
 * this worker verifies who they are, checks the payload against §8.3's trust
 * boundary, and commits the result to the repo. The site itself stays fully
 * static — nothing on a normal page load talks to this worker, and a save is
 * live once the Pages build that the commit triggers finishes, about a minute.
 *
 * Five files, one writer each (§8.1): `overrides.json` for club films — scores,
 * reviews, and the film's own record — `lists.json` for member lists,
 * `watched.json` for what members watched on their own, `club.json` for the
 * members themselves, and `trophies.json` for the awards they hand each other.
 * CI owns `films.json` and `listFilms.json` and this worker never touches them.
 *
 * That last part is why adding a film looks the way it does. A club film's
 * record is OMDb's response plus TMDb's, several kilobytes of crew, cast, and
 * stills, and it belongs in `films.json` — which this worker may not write. So a
 * member adding a film commits the *intent* to `overrides.json`, and
 * `create_submitted_films.py` builds the record on the next deploy. The film is
 * on the site about a minute later, by the same route and with the same latency
 * as every other save here.
 */

import { authenticate, memberNames } from './auth';
import { HttpError, badRequest, forbidden, notFound } from './errors';
import {
    CLUB_PATH,
    LISTS_PATH,
    OVERRIDES_PATH,
    TROPHIES_PATH,
    WATCHED_PATH,
    commitBinary,
    commitJson,
    fetchClubFilmIds,
    memberImagePath,
    readJson,
    type CommitPlan,
} from './github';
import { lookupFilm, searchFilms } from './omdb';
import type {
    Env,
    FilmListDefinition,
    FilmOverride,
    FilmOverrideRecord,
    Member,
    OverridesFile,
    RatingOverride,
    TeamMember,
    TrophiesFile,
    Trophy,
    WatchedEntry,
    WatchedLog,
} from './types';
import {
    FILM_PATCH_FIELDS,
    LIMITS,
    assertMayEditTrophy,
    assignListId,
    assignTrophyId,
    resolveListOwner,
    resolveOwner,
    validateAvatarUpload,
    validateFilmPatch,
    validateImdbId,
    validateListInput,
    validateProfilePatch,
    validateRatingPatch,
    validateTrophyInput,
    validateWatchedPatch,
    type FilmPatch,
    type ProfilePatch,
    type RatingPatch,
    type TrophyInput,
    type WatchedPatch,
} from './validate';

const EMPTY_OVERRIDES: OverridesFile = { films: {} };
const EMPTY_LISTS: FilmListDefinition[] = [];
const EMPTY_WATCHED: WatchedLog = {};
const EMPTY_TROPHIES: TrophiesFile = { films: {} };
/**
 * There is no empty club: `club.json` is the roster the whole site is built
 * around, and a missing or emptied file is a repo problem rather than a state
 * this worker should quietly write into.
 */
const EMPTY_CLUB: TeamMember[] = [];

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
    const allowed = (env.ALLOWED_ORIGIN || '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);

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
 *
 * The cap is a parameter for exactly one caller: an avatar upload carries an
 * image rather than the few hundred bytes of text every other route does, and
 * raising the shared limit to suit it would raise it for all of them.
 */
async function readBody(request: Request, limit: number = LIMITS.body): Promise<unknown> {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > limit) {
        throw badRequest(`Request body exceeds the ${limit / 1024} KB limit.`);
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
function mergeRating(
    existing: RatingOverride | undefined,
    patch: RatingPatch,
    member: Member
): RatingOverride {
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
    const body = await readBody(request);
    const patch = validateRatingPatch(body);
    // An admin filling in the evening's scores writes five rows that aren't
    // theirs; everyone else gets their own name back whatever they sent.
    const owner = resolveOwner(
        (body as Record<string, unknown>).owner,
        member,
        memberNames(env),
        'ratings'
    );

    await assertClubFilm(env, imdbId);

    const user = owner.toLowerCase();

    return commitJson<OverridesFile, unknown>(
        env,
        OVERRIDES_PATH,
        EMPTY_OVERRIDES,
        (current): CommitPlan<OverridesFile, unknown> => {
            const films = { ...(current.films ?? {}) };
            const film = films[imdbId] ?? { ratings: {} };
            const existing = film.ratings[user];

            if (ratingUnchanged(existing, patch)) {
                return {
                    commit: false,
                    result: { imdbID: imdbId, owner, rating: existing, changed: false },
                };
            }

            const rating = mergeRating(existing, patch, member);
            films[imdbId] = { ...film, ratings: { ...film.ratings, [user]: rating } };

            return {
                commit: true,
                next: { ...current, films },
                message:
                    owner === member.name
                        ? `Update rating: ${member.name} on ${imdbId}`
                        : `Update rating: ${owner} on ${imdbId} (by ${member.name})`,
                result: { imdbID: imdbId, owner, rating, changed: true },
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
async function deleteRating(
    env: Env,
    member: Member,
    imdbId: string,
    requestedOwner: string | null
): Promise<unknown> {
    const owner = resolveOwner(requestedOwner, member, memberNames(env), 'ratings');
    const user = owner.toLowerCase();

    return commitJson<OverridesFile, unknown>(
        env,
        OVERRIDES_PATH,
        EMPTY_OVERRIDES,
        (current): CommitPlan<OverridesFile, unknown> => {
            const film = current.films?.[imdbId];
            if (!film?.ratings?.[user]) {
                throw notFound(`No override to revert for ${owner} on ${imdbId}.`);
            }

            const ratings = { ...film.ratings };
            delete ratings[user];

            const films = { ...current.films };
            // Drop the film key once nothing is left on it — no overrides, no
            // film record — so the file doesn't accumulate empty shells. A film
            // added on the site keeps its key: that record is what CI reads.
            if (filmRecordEmpty({ ...film, ratings })) delete films[imdbId];
            else films[imdbId] = { ...film, ratings };

            return {
                commit: true,
                next: { ...current, films },
                message: `Revert rating: ${owner} on ${imdbId}`,
                result: { imdbID: imdbId, owner, reverted: true },
            };
        }
    );
}

// --- Club films ---------------------------------------------------------

/**
 * True when nothing is left on a film's record — no overrides, no club fields,
 * no submission — and the key should go rather than sit there as an empty shell.
 */
function filmRecordEmpty(record: FilmOverrideRecord): boolean {
    return (
        Object.keys(record.ratings ?? {}).length === 0 &&
        record.film === undefined &&
        record.added === undefined
    );
}

/**
 * Refuses a write about a film the club doesn't have.
 *
 * `films.json` used to be the whole answer, because the sheet was the only way
 * a film could arrive. Now one can be added here, and for the minute or two
 * before CI builds its record the only evidence it exists is the submission in
 * `overrides.json` — so a member who adds a film and immediately scores it must
 * not be told it isn't a club film.
 *
 * The second read only happens on a miss, which is the rare path: an id already
 * in `films.json` costs the cached id set and nothing else.
 */
async function assertClubFilm(env: Env, imdbId: string): Promise<void> {
    if ((await fetchClubFilmIds(env)).has(imdbId)) return;

    const { data } = await readJson<OverridesFile>(env, OVERRIDES_PATH);
    if (data?.films?.[imdbId]?.added) return;

    throw notFound(`${imdbId} isn't a club film yet. Add it from the films page first.`);
}

/**
 * Applies a validated patch to a film's club record.
 *
 * Field-level merge, exactly like {@link mergeRating}: only the keys the body
 * carried are touched, so setting the watch date leaves a curated backdrop
 * alone and an untouched field still defers to the sheet.
 */
function mergeFilm(
    existing: FilmOverride | undefined,
    patch: FilmPatch,
    member: Member
): FilmOverride {
    return { ...existing, ...patch, updatedBy: member.name, updatedAt: timestamp() };
}

/** True when the patch would leave the stored record's real fields unchanged. */
function filmUnchanged(existing: FilmOverride | undefined, patch: FilmPatch): boolean {
    if (!existing) return false;
    return (Object.keys(patch) as Array<keyof FilmPatch>).every(
        (field) => field in existing && existing[field] === patch[field]
    );
}

/**
 * Records a film's club details — whose pick it was, when the club watched it,
 * and the two pieces of art the site can't get right on its own — and, for an
 * id the club doesn't have yet, adds the film.
 *
 * **One route, two things, deliberately.** Adding a film and editing one are the
 * same write against the same record; what separates them is whether
 * `films.json` already knows the id, which is a fact about the repo rather than
 * about the request. Splitting them into `POST` and `PUT` would mean a client
 * deciding which to call from data it reads five minutes stale, and getting it
 * wrong on exactly the film someone else added in the meantime.
 *
 * Any member may write this, unlike a rating. A film's record is club property
 * rather than anyone's own row — the same reasoning as a trophy, whose recipient
 * is data and not a claim — and one person usually enters the whole evening.
 *
 * What creating adds is a {@link FilmSubmission} marker and an OMDb lookup to
 * back it (see {@link lookupFilm}). Neither is a club fact; both exist so CI can
 * build the film and the site can name it while that happens.
 */
async function putFilm(
    request: Request,
    env: Env,
    member: Member,
    imdbId: string
): Promise<unknown> {
    const patch = validateFilmPatch(await readBody(request), memberNames(env));

    const known = (await fetchClubFilmIds(env)).has(imdbId);
    if (known && Object.keys(patch).length === 0) {
        throw badRequest(`film: nothing to update (expected one of ${FILM_PATCH_FIELDS})`);
    }

    // Only for a film the club doesn't have: an id OMDb can't resolve would
    // commit fine and then fail in CI forever. Outside `commitJson` because the
    // mutation below can run twice and must make no requests of its own.
    const hit = known ? null : await lookupFilm(env, imdbId);

    return commitJson<OverridesFile, unknown>(
        env,
        OVERRIDES_PATH,
        EMPTY_OVERRIDES,
        (current): CommitPlan<OverridesFile, unknown> => {
            const films = { ...(current.films ?? {}) };
            const record: FilmOverrideRecord = films[imdbId] ?? { ratings: {} };
            const existing = record.film;

            // A film already submitted keeps its original marker: the second
            // save is an edit of that submission, not a re-adding of it, and
            // `addedBy` is who to ask about a film nobody recognizes.
            const added =
                known || record.added
                    ? record.added
                    : {
                          addedBy: member.name,
                          addedAt: timestamp(),
                          title: hit?.title ?? imdbId,
                          year: hit?.year ?? null,
                      };

            const created = added !== undefined && record.added === undefined;

            if (!created && filmUnchanged(existing, patch)) {
                return {
                    commit: false,
                    result: {
                        imdbID: imdbId,
                        film: existing,
                        added,
                        created: false,
                        changed: false,
                    },
                };
            }

            const film = mergeFilm(existing, patch, member);
            films[imdbId] = added === undefined ? { ...record, film } : { ...record, film, added };

            return {
                commit: true,
                next: { ...current, films },
                message: created
                    ? `Add film: ${added?.title ?? imdbId} (${member.name})`
                    : `Update film: ${member.name} on ${imdbId}`,
                result: { imdbID: imdbId, film, added, created, changed: true },
            };
        }
    );
}

/**
 * Drops a film's club record and hands it back to the sheet — or, for a film
 * added here that CI hasn't built yet, withdraws it altogether.
 *
 * The two cases are one action from the member's side ("undo this") and have to
 * be different underneath, because only one of them is reversible. Before CI
 * runs, a submission is a few lines in `overrides.json` and removing them
 * removes the film. After it runs, the record is in `films.json` — which this
 * worker may not write — so what a revert can still do is give the fields back
 * to the sheet, and the entry itself stays until someone edits the repo. The
 * response says which happened rather than leaving the member to infer it.
 *
 * Withdrawing is narrower than editing, on the {@link assertMayEditTrophy}
 * reasoning: any member may correct a film's details, but un-adding someone
 * else's film is the submitter's call, or an admin's.
 */
async function deleteFilm(env: Env, member: Member, imdbId: string): Promise<unknown> {
    const built = (await fetchClubFilmIds(env)).has(imdbId);

    return commitJson<OverridesFile, unknown>(
        env,
        OVERRIDES_PATH,
        EMPTY_OVERRIDES,
        (current): CommitPlan<OverridesFile, unknown> => {
            const record = current.films?.[imdbId];
            if (!record?.film && !record?.added) {
                throw notFound(`No film record to revert for ${imdbId}.`);
            }

            // Pending: the submission is the film, so this un-adds it.
            const withdrawn = record.added !== undefined && !built;
            if (withdrawn && record.added && !member.admin) {
                if (record.added.addedBy.toLowerCase() !== member.name.toLowerCase()) {
                    throw forbidden(
                        `${record.added.addedBy} added ${record.added.title}. Only they can withdraw it.`
                    );
                }
            }

            const next: FilmOverrideRecord = { ratings: record.ratings ?? {} };
            // A film CI has already built keeps its marker: the entry in
            // `films.json` is still one that arrived this way, and dropping the
            // provenance would not remove the film it describes.
            if (!withdrawn && record.added) next.added = record.added;

            const films = { ...current.films };
            if (filmRecordEmpty(next)) delete films[imdbId];
            else films[imdbId] = next;

            return {
                commit: true,
                next: { ...current, films },
                message: withdrawn
                    ? `Withdraw film: ${record.added?.title ?? imdbId} (${member.name})`
                    : `Revert film: ${member.name} on ${imdbId}`,
                result: { imdbID: imdbId, withdrawn, reverted: true },
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
        existing.posterImage === next.posterImage &&
        existing.trailerKey === next.trailerKey &&
        existing.hideTrailer === next.hideTrailer
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
                trailerKey:
                    'trailerKey' in patch
                        ? (patch.trailerKey ?? null)
                        : (existing?.trailerKey ?? null),
                hideTrailer:
                    'hideTrailer' in patch
                        ? (patch.hideTrailer ?? false)
                        : (existing?.hideTrailer ?? false),
                updatedAt: timestamp(),
            };

            if (watchedUnchanged(existing, next)) {
                return {
                    commit: false,
                    result: { entry: existing, created: false, changed: false },
                };
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
async function putList(
    request: Request,
    env: Env,
    member: Member,
    pathId: string
): Promise<unknown> {
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
                    id: assignListId(
                        owner,
                        input.name,
                        lists.map((list) => list.id)
                    ),
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

// --- Trophies -----------------------------------------------------------

/**
 * Awards on one film, in the order the club gave them out.
 *
 * Sorted by `awardedAt` with `id` breaking ties, so the order is total and a
 * save never reshuffles rows it didn't touch — the same reasoning as
 * {@link sortWatched}, and for the same reason: a reordering in the diff that
 * isn't a change is noise in a file six people read.
 */
function sortTrophies(trophies: Trophy[]): Trophy[] {
    return [...trophies].sort((a, b) =>
        a.awardedAt === b.awardedAt
            ? a.id.localeCompare(b.id)
            : a.awardedAt.localeCompare(b.awardedAt)
    );
}

/** Rebuilds the file with film keys in a stable order, so diffs stay local. */
function sortedTrophies(files: TrophiesFile['films']): TrophiesFile['films'] {
    const next: TrophiesFile['films'] = {};
    for (const imdbId of Object.keys(files).sort()) next[imdbId] = files[imdbId];
    return next;
}

/** The stored fields, minus the provenance a no-op save shouldn't touch. */
function trophyUnchanged(existing: Trophy | undefined, input: TrophyInput): boolean {
    return (
        existing !== undefined &&
        existing.recipient === input.recipient &&
        existing.award === input.award &&
        existing.note === input.note
    );
}

/**
 * Hands a member an award for a club film, or edits one already given.
 *
 * The id in the path is a lookup key, exactly as it is for a list: an unmatched
 * one creates and the worker assigns the permanent id itself. Clients creating
 * should PUT to `/api/films/:imdbId/trophies/new`.
 *
 * Two things separate this from every other write here. The film must be a club
 * film — a trophy commemorates a screening, so unlike a watch-log entry it
 * cannot attach to something the club never saw. And the caller is writing about
 * *someone else*: `recipient` is data rather than an ownership claim, while
 * `awardedBy` — the field that does carry authority — is taken from the token
 * and never from the body.
 */
async function putTrophy(
    request: Request,
    env: Env,
    member: Member,
    imdbId: string,
    pathId: string
): Promise<unknown> {
    const input = validateTrophyInput(await readBody(request), memberNames(env));

    await assertClubFilm(env, imdbId);

    return commitJson<TrophiesFile, unknown>(
        env,
        TROPHIES_PATH,
        EMPTY_TROPHIES,
        (current): CommitPlan<TrophiesFile, unknown> => {
            const films = { ...(current.films ?? {}) };
            const trophies = [...(films[imdbId] ?? [])];
            const index = trophies.findIndex((trophy) => trophy.id === pathId);
            const existing = index === -1 ? undefined : trophies[index];

            if (existing) assertMayEditTrophy(existing, member);
            else if (trophies.length >= LIMITS.trophiesPerFilm) {
                throw badRequest(`A film holds at most ${LIMITS.trophiesPerFilm} trophies.`);
            }

            if (trophyUnchanged(existing, input)) {
                return {
                    commit: false,
                    result: { trophy: existing, created: false, changed: false },
                };
            }

            const next: Trophy = {
                // An edit keeps its id and its author: the row is the same award
                // with its name spelled right, not a new one from whoever fixed it.
                id:
                    existing?.id ??
                    assignTrophyId(
                        input.recipient,
                        input.award,
                        trophies.map((t) => t.id)
                    ),
                recipient: input.recipient,
                award: input.award,
                note: input.note,
                awardedBy: existing?.awardedBy ?? member.name,
                awardedAt: existing?.awardedAt ?? timestamp(),
            };

            if (index === -1) trophies.push(next);
            else trophies[index] = next;
            films[imdbId] = sortTrophies(trophies);

            return {
                commit: true,
                next: { ...current, films: sortedTrophies(films) },
                message: `${existing ? 'Update' : 'Award'} trophy: ${next.award} to ${next.recipient} on ${imdbId}`,
                result: { trophy: next, created: index === -1, changed: true },
            };
        }
    );
}

/** Withdraws an award. Whoever gave it, or an admin — see `assertMayEditTrophy`. */
async function deleteTrophy(
    env: Env,
    member: Member,
    imdbId: string,
    trophyId: string
): Promise<unknown> {
    return commitJson<TrophiesFile, unknown>(
        env,
        TROPHIES_PATH,
        EMPTY_TROPHIES,
        (current): CommitPlan<TrophiesFile, unknown> => {
            const trophies = current.films?.[imdbId] ?? [];
            const existing = trophies.find((trophy) => trophy.id === trophyId);
            if (!existing) throw notFound(`No trophy "${trophyId}" on ${imdbId}.`);

            assertMayEditTrophy(existing, member);

            const remaining = trophies.filter((trophy) => trophy.id !== trophyId);
            const films = { ...current.films };
            // Drop the film key with its last award, so the file doesn't
            // accumulate empty arrays for films whose trophies were withdrawn.
            if (remaining.length === 0) delete films[imdbId];
            else films[imdbId] = remaining;

            return {
                commit: true,
                next: { ...current, films: sortedTrophies(films) },
                message: `Withdraw trophy: ${existing.award} from ${existing.recipient} on ${imdbId}`,
                result: { imdbID: imdbId, id: trophyId, deleted: true },
            };
        }
    );
}

// --- Profiles -----------------------------------------------------------

/**
 * Applies a validated patch to one member's `club.json` record.
 *
 * Field-level merge like every other write here, with one wrinkle: how a cleared
 * field is stored depends on whether `club.json` calls it optional. `title` and
 * `bio` are required strings the site renders unconditionally, so a cleared one
 * is blank. `url` and `interview` are optional and simply disappear — which is
 * how a member who never had either is already stored, and saves the site from
 * having to tell an absent link from a `null` one.
 *
 * No `updatedBy`/`updatedAt` is stamped, unlike a rating override. Those exist
 * there because two writers share the file; here the commit message is the whole
 * provenance, and inventing fields would put them in the bundle's `TeamMember`.
 */
function mergeProfile(existing: TeamMember, patch: ProfilePatch): TeamMember {
    const next: TeamMember = { ...existing };

    if (patch.title !== undefined) next.title = patch.title;
    if (patch.bio !== undefined) next.bio = patch.bio;
    if (patch.image !== undefined) next.image = patch.image ?? '';

    if (patch.url !== undefined) {
        if (patch.url === null) delete next.url;
        else next.url = patch.url;
    }
    if (patch.interview !== undefined) {
        if (patch.interview.length === 0) delete next.interview;
        else next.interview = patch.interview;
    }

    // Both banner fields follow the optional-field rule above, and their absent
    // state is the default: no `backdropMode` is `top-rated`, and no
    // `backdropFilms` is a selection the site falls back out of. A member who
    // switches back to top-rated keeps nothing behind.
    if (patch.backdropMode !== undefined) {
        if (patch.backdropMode === 'top-rated') delete next.backdropMode;
        else next.backdropMode = patch.backdropMode;
    }
    if (patch.backdropFilms !== undefined) {
        if (patch.backdropFilms.length === 0) delete next.backdropFilms;
        else next.backdropFilms = patch.backdropFilms;
    }

    return next;
}

/**
 * Applies a validated patch to one member's record and commits it.
 *
 * Shared by the two routes that write `club.json` — the profile form and an
 * avatar upload, which finishes by pointing `image` at the file it just
 * committed. Both need the same 404 on an unknown member and the same "changed
 * nothing, so don't spend a Pages build" check.
 */
async function commitProfile(env: Env, owner: string, patch: ProfilePatch): Promise<ProfileResult> {
    return commitJson<TeamMember[], ProfileResult>(
        env,
        CLUB_PATH,
        EMPTY_CLUB,
        (current): CommitPlan<TeamMember[], ProfileResult> => {
            const index = current.findIndex(
                (entry) => entry.name.toLowerCase() === owner.toLowerCase()
            );
            if (index === -1) {
                throw notFound(`${owner} has no profile in club.json.`);
            }

            const existing = current[index];
            const updated = mergeProfile(existing, patch);

            // Key order survives the spread, so this compares content rather
            // than shape — a save that changed nothing must not cost a commit
            // and the full Pages build behind it.
            if (JSON.stringify(existing) === JSON.stringify(updated)) {
                return { commit: false, result: { member: updated, changed: false } };
            }

            const members = [...current];
            members[index] = updated;

            return {
                commit: true,
                next: members,
                message: `Update profile: ${owner}`,
                result: { member: updated, changed: true },
            };
        }
    );
}

/** What both profile routes answer with: the stored record, and whether it moved. */
interface ProfileResult {
    member: TeamMember;
    changed: boolean;
}

/**
 * Edits the caller's own profile — their picture, their role line, their bio,
 * their link, and their interview.
 *
 * The worker cannot *create* a member, only edit one: an unknown owner is a 404
 * rather than a new record, for the same reason `PUT …/rating` refuses a film
 * the sheet doesn't know. `club.json` is the roster the entire site joins on,
 * and adding to it stays a repo edit.
 */
async function putProfile(request: Request, env: Env, member: Member): Promise<unknown> {
    const body = await readBody(request);
    const patch = validateProfilePatch(body);
    const owner = resolveOwner(
        (body as Record<string, unknown>).owner,
        member,
        memberNames(env),
        'profile'
    );

    return commitProfile(env, owner, patch);
}

/**
 * Takes a picture rather than a link to one, and puts it in the repo.
 *
 * A member's `image` has always been a URL, which is fine for someone who
 * already hosts their photograph somewhere and useless for everyone else. This
 * is the other half: the browser resizes the file it was given, sends the bytes,
 * and the worker commits them to `public/images/members/` and points the profile
 * at the result.
 *
 * **Two commits, deliberately.** The image and `club.json` are separate files, so
 * writing both atomically would mean the git tree API — five calls and its own
 * failure modes — to save a Pages build that `deploy.yml`'s `cancel-in-progress`
 * concurrency group already collapses. The order is what matters: the file lands
 * first, so the profile never points at a path that isn't there yet. If the
 * second half fails the member has an unreferenced file in the repo and an
 * unchanged profile, which is the harmless direction for this to break.
 */
async function putProfileImage(request: Request, env: Env, member: Member): Promise<unknown> {
    const body = await readBody(request, LIMITS.avatarBody);
    const upload = validateAvatarUpload(body);
    const owner = resolveOwner(
        (body as Record<string, unknown>).owner,
        member,
        memberNames(env),
        'profile'
    );

    const path = await memberImagePath(owner, upload.extension, upload.base64);
    const uploaded = await commitBinary(
        env,
        path,
        upload.base64,
        `Upload profile picture: ${owner}`
    );

    // `public/images/members/andy-1f4c….jpg` is served at `/images/members/…`,
    // which is the form `club.json` stores and the form the site renders.
    const image = path.replace(/^public/, '');
    const result = await commitProfile(env, owner, { image });

    return { ...result, image, uploaded };
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

    if (path === '/api/club' && method === 'GET') {
        const { data } = await readJson<TeamMember[]>(env, CLUB_PATH);
        return { club: data ?? EMPTY_CLUB };
    }

    if (path === '/api/profile/image') {
        if (method === 'PUT') return putProfileImage(request, env, member);
        throw new HttpError(405, `${method} not allowed on ${path}.`);
    }

    if (path === '/api/profile') {
        if (method === 'PUT') return putProfile(request, env, member);
        throw new HttpError(405, `${method} not allowed on ${path}.`);
    }

    if (path === '/api/films/search' && method === 'GET') {
        const query = (url.searchParams.get('q') ?? '').trim();
        if (query.length < 2) throw badRequest('Search needs at least two characters.');
        return { results: await searchFilms(env, query) };
    }

    const trophyMatch = /^\/api\/films\/([^/]+)\/trophies\/([^/]+)$/.exec(path);
    if (trophyMatch) {
        const imdbId = validateImdbId(decodeURIComponent(trophyMatch[1]), 'imdbId');
        const trophyId = decodeURIComponent(trophyMatch[2]);
        if (method === 'PUT') return putTrophy(request, env, member, imdbId, trophyId);
        if (method === 'DELETE') return deleteTrophy(env, member, imdbId, trophyId);
        throw new HttpError(405, `${method} not allowed on ${path}.`);
    }

    const ratingMatch = /^\/api\/films\/([^/]+)\/rating$/.exec(path);
    if (ratingMatch) {
        const imdbId = validateImdbId(decodeURIComponent(ratingMatch[1]), 'imdbId');
        if (method === 'PUT') return putRating(request, env, member, imdbId);
        // The owner rides in the query for the same reason it does on a watch
        // log below: DELETE bodies are poorly supported by intermediaries.
        if (method === 'DELETE') {
            return deleteRating(env, member, imdbId, url.searchParams.get('owner'));
        }
        throw new HttpError(405, `${method} not allowed on ${path}.`);
    }

    // Below the two routes above, so `/rating` and `/trophies/…` match first.
    const filmMatch = /^\/api\/films\/([^/]+)$/.exec(path);
    if (filmMatch) {
        const imdbId = validateImdbId(decodeURIComponent(filmMatch[1]), 'imdbId');
        if (method === 'PUT') return putFilm(request, env, member, imdbId);
        if (method === 'DELETE') return deleteFilm(env, member, imdbId);
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
