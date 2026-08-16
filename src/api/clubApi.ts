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
import type { InterviewItem, TeamMember } from '../types/team';
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

/** The shape of `overrides.json`, keyed by IMDb id then by lowercased member name. */
export interface OverridesFile {
    films: Record<string, { ratings: Record<string, RatingOverride> }>;
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
};

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

export const deleteRating = (
    token: string,
    imdbId: string
): Promise<{ imdbID: string; reverted: boolean }> =>
    request(`/api/films/${encodeURIComponent(imdbId)}/rating`, token, { method: 'DELETE' });

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
