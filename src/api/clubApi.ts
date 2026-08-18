/**
 * Typed wrappers around the editing worker (§8.4 of the lists plan).
 *
 * Nothing on an ordinary page load calls any of this: the site is static and
 * reads its data from the bundle. These are only reached while a signed-in
 * member is editing, and every one of them carries the Google ID token as a
 * bearer header — the worker has no unauthenticated surface beyond the CORS
 * preflight.
 *
 * Only the two endpoints that *need* the worker are here. Reading the editable
 * files no longer does: the repository is public, so `repoData.ts` fetches them
 * from `raw.githubusercontent.com` for free instead of spending a Workers
 * request on each. What remains is `/api/session`, which checks a Google token
 * against a secret, `/api/films/search`, which keeps the OMDB key server-side,
 * and every write.
 */

import { EDITOR_API_URL as API_BASE, GOOGLE_CLIENT_ID } from '../config/editorEnv';
import type { FilmListDefinition, FilmListEntry } from '../types/list';
import type { BackdropMode, InterviewItem, TeamMember } from '../types/team';
import type { Trophy } from '../types/trophy';
import type { WatchedEntry } from '../types/watched';

export { GOOGLE_CLIENT_ID };

/**
 * Whether this build can talk to the worker at all.
 *
 * Both values are build-time env vars, and a fork or a local checkout without
 * them is a perfectly valid way to run the site. Every editing entry point
 * checks this and renders nothing when it's false, so the read-only site never
 * offers an action that would immediately fail.
 */
export const isEditorConfigured = (): boolean => API_BASE !== '' && GOOGLE_CLIENT_ID !== '';

/** An error carrying the worker's HTTP status, so callers can treat 401 specially. */
export class ClubApiError extends Error {
    readonly status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = 'ClubApiError';
        this.status = status;
    }
}

/** `{ member, admin }` — resolves a token to a club member (§8.4). */
export interface SessionInfo {
    member: string;
    admin: boolean;
}

/**
 * One member's edits to one film's rating, as stored in `overrides.json`.
 *
 * Presence is meaningful and mirrors the worker's type of the same name: an
 * absent key means "whatever the sheet says stands", an explicit `null` means
 * "deliberately blank" (§8.7).
 */
export interface RatingOverride {
    score?: number | null;
    scoreQualifier?: string | null;
    blurb?: string | null;
    updatedBy: string;
    updatedAt: string;
}

/**
 * A film's own club record as members have edited it, mirroring the worker's
 * type of the same name.
 *
 * Presence is meaningful here too: an absent key defers to the sheet, an
 * explicit `null` is a deliberate blank. `poster` and `backdropImage` are the
 * two images the site can't source for itself — OMDb's cover is often the wrong
 * edition, and the wide still behind the selection committee was a hand-edit to
 * `films.json` until now.
 */
export interface FilmOverride {
    /** A club member's name — whose pick it was. */
    selector?: string | null;
    /** `MM/DD/YYYY`, the form `films.json` stores. */
    watchDate?: string | null;
    /** An `https` cover to use in place of OMDb's. */
    poster?: string | null;
    /** An `https` wide still for the hero background. */
    backdropImage?: string | null;
    updatedBy: string;
    updatedAt: string;
}

/**
 * The marker on a film that entered the club here rather than through the
 * sheet. Written once, when the film is added; CI reads it to know which films
 * it still has to fetch from OMDb and TMDb.
 */
export interface FilmSubmission {
    addedBy: string;
    addedAt: string;
    /** OMDb's title, so the pending state can name the film rather than an id. */
    title: string;
    year: string | null;
}

/** Everything recorded against one film in `overrides.json`. */
export interface FilmOverrideRecord {
    ratings: Record<string, RatingOverride>;
    film?: FilmOverride;
    added?: FilmSubmission;
}

/**
 * The half of a film's record a film write touches — everything but the ratings,
 * which belong to their members and are written one row at a time.
 */
export type FilmRecordPatch = Pick<FilmOverrideRecord, 'film' | 'added'>;

/** The shape of `overrides.json`, keyed by IMDb id. */
export interface OverridesFile {
    films: Record<string, FilmOverrideRecord>;
}

/**
 * A rating write. Only the keys present are applied — `PUT …/rating` is a
 * field-level merge, which is what lets a member fix their score without wiping
 * a blurb the sheet supplied.
 */
export type RatingPatch = {
    score?: number | null;
    scoreQualifier?: string | null;
    blurb?: string | null;
    /** Admins only; omitted, the worker uses the caller's own name. */
    owner?: string;
};

/**
 * A film's club details, as they go to the worker. Only the keys present are
 * applied, the same field-level merge every other write here uses.
 *
 * An empty patch is meaningful on one path and one only: `PUT /api/films/:id`
 * for an id the club doesn't have yet *adds the film*, and adding one before
 * anything is known about the evening is a legitimate thing to do.
 */
export interface FilmPatch {
    /** A club member's name, or null to leave it unrecorded. */
    selector?: string | null;
    /** `YYYY-MM-DD` or `MM/DD/YYYY`; the worker normalizes and stores the latter. */
    watchDate?: string | null;
    /** An `https` URL for the cover art, or null for OMDb's. */
    poster?: string | null;
    /** An `https` URL for the hero background, or null for TMDb's stills. */
    backdropImage?: string | null;
}

/** The list fields a client supplies. `id` and `rank` are the worker's to assign. */
export interface ListInput {
    name: string;
    description: string | null;
    /** Whether the order renders as a numbered ranking. Omitted, the worker assumes it does. */
    ranked?: boolean;
    entries: Pick<
        FilmListEntry,
        'imdbID' | 'description' | 'image' | 'posterImage' | 'score' | 'trailerKey' | 'hideTrailer'
    >[];
    /** Admins only; omitted, the worker uses the caller's own name. */
    owner?: string;
}

/** One OMDB search hit, trimmed to what the add-film picker needs. */
export interface FilmSearchResult {
    imdbID: string;
    title: string;
    year: string | null;
    poster: string | null;
}

interface RequestOptions {
    method?: 'GET' | 'PUT' | 'DELETE';
    body?: unknown;
    signal?: AbortSignal;
}

/**
 * One request against the worker.
 *
 * Failures come back as `ClubApiError` with the worker's own message, which is
 * written to be shown to a member ("That's Andy's list", "score: must be
 * between 0 and 10") rather than logged. A transport failure — worker down,
 * DNS, offline — has no status, so it gets 0 and a generic message.
 */
async function request<T>(path: string, token: string, options: RequestOptions = {}): Promise<T> {
    if (!API_BASE) {
        throw new ClubApiError(0, 'Editing is not configured for this build.');
    }

    const { method = 'GET', body, signal } = options;

    let response: Response;
    try {
        response = await fetch(`${API_BASE}${path}`, {
            method,
            signal,
            headers: {
                Authorization: `Bearer ${token}`,
                ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
            },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    } catch (error) {
        // Rethrow an abort untouched: a cancelled search is not a failure, and
        // callers check `error.name === 'AbortError'`.
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        throw new ClubApiError(
            0,
            "Couldn't reach the server. Check your connection and try again."
        );
    }

    // The worker answers with JSON on every path, including errors — but a
    // Cloudflare-level failure (a 522, a WAF block) would not, so parsing is
    // guarded rather than assumed.
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
        const message =
            typeof payload === 'object' && payload !== null && 'error' in payload
                ? String((payload as { error: unknown }).error)
                : `Request failed (${response.status}).`;
        throw new ClubApiError(response.status, message);
    }

    return payload as T;
}

export const getSession = (token: string, signal?: AbortSignal): Promise<SessionInfo> =>
    request<SessionInfo>('/api/session', token, { signal });

/** The result of a rating write. `changed: false` means the save was a no-op. */
export interface RatingWriteResult {
    imdbID: string;
    /**
     * Whose row was written, resolved by the worker. Not always the caller: an
     * admin filling in the evening's scores writes rows that aren't theirs, and
     * `rating.updatedBy` names the person who typed it rather than the person
     * it belongs to — so this is the field to key a local update by.
     */
    owner: string;
    rating: RatingOverride;
    changed: boolean;
}

export const putRating = (
    token: string,
    imdbId: string,
    patch: RatingPatch
): Promise<RatingWriteResult> =>
    request<RatingWriteResult>(`/api/films/${encodeURIComponent(imdbId)}/rating`, token, {
        method: 'PUT',
        body: patch,
    });

/**
 * Drops an override and hands the row back to the sheet. `owner` is for admins
 * acting on someone else's row and rides in the query string, like the watch
 * log's — a DELETE body is poorly supported by intermediaries.
 */
export const deleteRating = (
    token: string,
    imdbId: string,
    owner?: string
): Promise<{ imdbID: string; owner: string; reverted: boolean }> =>
    request(
        `/api/films/${encodeURIComponent(imdbId)}/rating${owner ? `?owner=${encodeURIComponent(owner)}` : ''}`,
        token,
        { method: 'DELETE' }
    );

/** The result of a film write. `created` is true when this added the film. */
export interface FilmWriteResult {
    imdbID: string;
    film: FilmOverride;
    /** Present on any film added here, whether or not this call is what added it. */
    added?: FilmSubmission;
    created: boolean;
    changed?: boolean;
}

/**
 * Records a film's club details, and adds the film when the club doesn't have it.
 *
 * One call for both because they are the same write against the same record;
 * what separates them is whether `films.json` already knows the id, which the
 * worker checks against the repo rather than trusting a client to have read
 * correctly. `created` in the response says which happened.
 *
 * A film added here is on the site after the next deploy — about a minute —
 * because building its record takes OMDb and TMDb and happens in CI.
 */
export const putFilm = (
    token: string,
    imdbId: string,
    patch: FilmPatch
): Promise<FilmWriteResult> =>
    request<FilmWriteResult>(`/api/films/${encodeURIComponent(imdbId)}`, token, {
        method: 'PUT',
        body: patch,
    });

/**
 * The result of a revert. `withdrawn` is true when the film itself was removed,
 * which is only possible before CI has built it — after that the entry is in
 * `films.json`, which no worker may write, and the revert gives the fields back
 * to the sheet instead.
 */
export interface FilmDeleteResult {
    imdbID: string;
    withdrawn: boolean;
    reverted: boolean;
}

export const deleteFilm = (token: string, imdbId: string): Promise<FilmDeleteResult> =>
    request(`/api/films/${encodeURIComponent(imdbId)}`, token, { method: 'DELETE' });

/** The result of a list write; `list.id` is authoritative and may be worker-assigned. */
export interface ListWriteResult {
    list: FilmListDefinition;
    created: boolean;
    changed?: boolean;
}

/**
 * Creates or replaces one list.
 *
 * `id` is only a lookup key: an unknown one creates, and the worker assigns the
 * permanent id itself. Pass `NEW_LIST_ID` when creating — the id it returns is
 * the one to navigate to.
 */
export const putList = (token: string, id: string, input: ListInput): Promise<ListWriteResult> =>
    request<ListWriteResult>(`/api/lists/${encodeURIComponent(id)}`, token, {
        method: 'PUT',
        body: input,
    });

/** The documented placeholder id for a create. Any unmatched id behaves the same. */
export const NEW_LIST_ID = 'new';

export const deleteList = (token: string, id: string): Promise<{ id: string; deleted: boolean }> =>
    request(`/api/lists/${encodeURIComponent(id)}`, token, { method: 'DELETE' });

/**
 * A watch-log write. Only the keys present are applied, the same field-level
 * merge `PUT …/rating` uses — so saving a review leaves the date and score
 * alone, and logging a film with no fields at all dates it today.
 */
export interface WatchedPatch {
    /** `YYYY-MM-DD`. Defaults to today when a film is first logged. */
    watchDate?: string;
    score?: number | null;
    scoreQualifier?: string | null;
    blurb?: string | null;
    /** An `https` URL for the row's background art, or null to clear it. */
    image?: string | null;
    /** An `https` URL to use as the film's poster, or null to clear it. */
    posterImage?: string | null;
    /**
     * A YouTube video key to play instead of the film's own trailer, or null to
     * go back to it. The worker takes a full YouTube URL here too and stores the
     * key either way.
     */
    trailerKey?: string | null;
    /** True to offer no trailer on this row at all; wins over `trailerKey`. */
    hideTrailer?: boolean;
    /** Admins only; omitted, the worker uses the caller's own name. */
    owner?: string;
}

/** The result of a watch-log write. `changed: false` means the save was a no-op. */
export interface WatchedWriteResult {
    entry: WatchedEntry;
    created: boolean;
    changed?: boolean;
}

export const putWatched = (
    token: string,
    imdbId: string,
    patch: WatchedPatch
): Promise<WatchedWriteResult> =>
    request<WatchedWriteResult>(`/api/watched/${encodeURIComponent(imdbId)}`, token, {
        method: 'PUT',
        body: patch,
    });

/**
 * Removes a film from a log. `owner` is for admins acting on someone else's
 * log and rides in the query string — a DELETE body is poorly supported by
 * intermediaries.
 */
export const deleteWatched = (
    token: string,
    imdbId: string,
    owner?: string
): Promise<{ imdbID: string; owner: string; deleted: boolean }> =>
    request(
        `/api/watched/${encodeURIComponent(imdbId)}${owner ? `?owner=${encodeURIComponent(owner)}` : ''}`,
        token,
        { method: 'DELETE' }
    );

/**
 * One award, as it goes to the worker. Whole-record rather than a merge: the
 * editor shows all three fields, so there is no partial write to express.
 *
 * `awardedBy` is deliberately absent — the worker takes it from the token. It is
 * the field that decides who may later change the award, so a client that could
 * set it could hand out trophies nobody can withdraw.
 */
export interface TrophyInput {
    /** A club member's name. Any member may be named; this is data, not a claim. */
    recipient: string;
    /** What the award is called, e.g. `Togetherness Trophy`. */
    award: string;
    /** Why they got it, or null. */
    note?: string | null;
}

/** The result of a trophy write. `changed: false` means the save was a no-op. */
export interface TrophyWriteResult {
    trophy: Trophy;
    created: boolean;
    changed?: boolean;
}

/**
 * Awards a trophy, or edits one already given.
 *
 * `id` is only a lookup key, exactly as it is for a list: an unmatched one
 * creates and the worker assigns the permanent id itself. Pass
 * {@link NEW_TROPHY_ID} when awarding.
 */
export const putTrophy = (
    token: string,
    imdbId: string,
    id: string,
    input: TrophyInput
): Promise<TrophyWriteResult> =>
    request<TrophyWriteResult>(
        `/api/films/${encodeURIComponent(imdbId)}/trophies/${encodeURIComponent(id)}`,
        token,
        { method: 'PUT', body: input }
    );

/** The documented placeholder id for a new award. Any unmatched id behaves the same. */
export const NEW_TROPHY_ID = 'new';

export const deleteTrophy = (
    token: string,
    imdbId: string,
    id: string
): Promise<{ imdbID: string; id: string; deleted: boolean }> =>
    request(`/api/films/${encodeURIComponent(imdbId)}/trophies/${encodeURIComponent(id)}`, token, {
        method: 'DELETE',
    });

/**
 * The fields of their own profile a member may change.
 *
 * Only the keys present are applied, the same field-level merge the other
 * writes use — so saving an interview leaves the bio alone. `interview` is the
 * exception *within* a field: it arrives whole or not at all.
 *
 * `name` is not here and never will be: it is the key every rating, list, and
 * watch log joins on. `queue` and `color` are missing for a milder reason —
 * they are club-wide settings that happen to be stored per member.
 */
export interface ProfilePatch {
    title?: string;
    bio?: string;
    /** An `https` URL, or null to remove the link. */
    url?: string | null;
    /** An `https` URL or a site path like `/images/andy.jpg`; null clears it. */
    image?: string | null;
    interview?: InterviewItem[];
    /** Where the profile banner draws its art. `top-rated` is stored as no field at all. */
    backdropMode?: BackdropMode;
    /** IMDb ids for the banner. Whole array or not at all, like `interview`. */
    backdropFilms?: string[];
    /** Admins only; omitted, the worker uses the caller's own name. */
    owner?: string;
}

/** The result of a profile write. `changed: false` means the save was a no-op. */
export interface ProfileWriteResult {
    member: TeamMember;
    changed: boolean;
}

export const putProfile = (token: string, patch: ProfilePatch): Promise<ProfileWriteResult> =>
    request<ProfileWriteResult>('/api/profile', token, { method: 'PUT', body: patch });

/**
 * A profile picture sent as bytes rather than linked as a URL.
 *
 * The only payload on this API that isn't text somebody typed. The image is
 * resized and base64-encoded in the browser first — `prepareAvatarUpload` in
 * `src/utils/imageUpload.ts` — because what lands here is committed to the
 * repository and stays there.
 */
export interface ProfileImageUpload {
    /** One of `image/jpeg`, `image/png`, `image/webp`. */
    contentType: string;
    /** Base64, no `data:` prefix. */
    data: string;
    /** Admins only; omitted, the worker uses the caller's own name. */
    owner?: string;
}

/**
 * The result of an upload. It writes `club.json` too, so it answers with the
 * stored member like any other profile write.
 */
export interface ProfileImageResult extends ProfileWriteResult {
    /** The site path the picture now lives at, e.g. `/images/members/andy-1f4c….jpg`. */
    image: string;
    /**
     * False when the repo already held this exact image — the paths are content
     * hashes, so re-uploading the same file costs no commit.
     */
    uploaded: boolean;
}

export const putProfileImage = (
    token: string,
    upload: ProfileImageUpload
): Promise<ProfileImageResult> =>
    request<ProfileImageResult>('/api/profile/image', token, { method: 'PUT', body: upload });

export const searchFilms = async (
    token: string,
    query: string,
    signal?: AbortSignal
): Promise<FilmSearchResult[]> => {
    const { results } = await request<{ results: FilmSearchResult[] }>(
        `/api/films/search?q=${encodeURIComponent(query)}`,
        token,
        { signal }
    );
    return results;
};
