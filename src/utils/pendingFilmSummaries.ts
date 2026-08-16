import { filmData } from '../types/film';
import { listFilmSummaries, type ListFilmSummary } from '../types/list';

/**
 * Poster and title for films picked from search but not yet in the bundle.
 *
 * `listFilms.json` is built in CI (`enrich_list_films.py`) from the ids that
 * `lists.json` and `watched.json` reference, so a film added on the site has no
 * summary until the next deploy — a minute or two later. Until then the resolvers
 * have nothing but an id and the row renders as "Unknown film" with no poster,
 * which is the state a member sees for exactly as long as they are still working
 * on the thing they just added.
 *
 * The search hit that put the film there already carried its title, year, and
 * poster. This is where that gets kept: written when a film is picked, read as
 * the last source the resolvers consult, and superseded the moment CI catches up,
 * since the bundled summary is checked first and is the richer record.
 *
 * `localStorage` rather than `sessionStorage`: the gap spans a deploy, and
 * closing the tab in the middle of it is ordinary. Nothing here is private —
 * these are OMDB posters for films the member has already published — so the
 * reasoning in `auth/sessionStore.ts` for keeping the token off disk doesn't
 * apply.
 */

const KEY = 'cc.pendingFilms';

/**
 * How long a remembered summary outlives its write. Long enough to cover a
 * failed deploy that gets retried the next day, short enough that a film OMDB
 * has no record of stops being drawn from a stale cache. Entries the bundle has
 * since learned are dropped before this ever expires them.
 */
const TTL_MS = 14 * 24 * 60 * 60 * 1000;

interface PendingRecord {
    summary: ListFilmSummary;
    /** Epoch ms, for {@link TTL_MS}. */
    savedAt: number;
}

/**
 * The in-memory copy, so resolving a hundred rows doesn't parse JSON a hundred
 * times. `null` means "not read yet"; the parsed map is authoritative afterwards
 * and is what gets written back.
 */
let cache: Record<string, PendingRecord> | null = null;

/** Lazy id set of everything the bundle already knows, club films included. */
let bundledIds: Set<string> | null = null;

const knownToBundle = (imdbID: string): boolean => {
    bundledIds ??= new Set([...Object.keys(listFilmSummaries), ...filmData.map((f) => f.imdbID)]);
    return bundledIds.has(imdbID);
};

/** A record we would still draw from: shaped right, unexpired, still unknown. */
const isLive = (imdbID: string, record: unknown): record is PendingRecord => {
    if (typeof record !== 'object' || record === null) return false;
    const { summary, savedAt } = record as Partial<PendingRecord>;
    if (typeof summary !== 'object' || summary === null) return false;
    if (typeof summary.title !== 'string' || summary.title.length === 0) return false;
    if (typeof savedAt !== 'number' || Date.now() - savedAt > TTL_MS) return false;
    return !knownToBundle(imdbID);
};

/**
 * Reads the store, dropping everything {@link isLive} rejects — expired, junk,
 * or since deployed. Pruning here rather than on a timer means the store cleans
 * itself up on the next page that resolves a row, and the pruned map is what the
 * next write persists.
 *
 * Storage throws rather than no-ops in Safari's private mode, on a full quota,
 * and in webviews with storage disabled. None of that should break rendering a
 * list, so a failure just means the film shows as unknown until the deploy —
 * which is the behavior this replaced.
 */
const load = (): Record<string, PendingRecord> => {
    if (cache) return cache;

    cache = {};
    try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
            const parsed: unknown = JSON.parse(raw);
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                for (const [imdbID, record] of Object.entries(parsed as Record<string, unknown>)) {
                    if (isLive(imdbID, record)) cache[imdbID] = record;
                }
            }
        }
    } catch {
        // Unreadable or unparseable: start empty rather than throwing mid-render.
    }
    return cache;
};

const persist = (): void => {
    try {
        localStorage.setItem(KEY, JSON.stringify(cache));
    } catch {
        // Not sticky in this browser. The current page still resolves from the
        // in-memory copy above.
    }
};

/**
 * Keeps what a search hit knew about a film, against the row that is about to
 * be built from it.
 *
 * Takes the fields structurally rather than a `FilmSearchResult` so this module
 * stays out of the API layer's dependencies. A film the bundle already knows is
 * not stored: its summary would never be read, since both resolvers prefer the
 * bundled record.
 */
export const rememberFilmSummary = (hit: {
    imdbID: string;
    title: string;
    year: string | null;
    poster: string | null;
}): void => {
    if (hit.title.trim() === '' || knownToBundle(hit.imdbID)) return;

    const store = load();
    store[hit.imdbID] = {
        summary: {
            imdbID: hit.imdbID,
            title: hit.title,
            year: hit.year,
            poster: hit.poster,
        },
        savedAt: Date.now(),
    };
    persist();
};

/**
 * What was kept for an id, if anything. Consulted by `resolveListEntry` and
 * `resolveWatchedEntry` after the bundled cache misses and before they give up
 * on the title.
 */
export const pendingFilmSummary = (imdbID: string): ListFilmSummary | undefined =>
    load()[imdbID]?.summary;

/** Drops everything remembered. For tests, and for a sign-out to call one day. */
export const clearPendingFilmSummaries = (): void => {
    cache = null;
    bundledIds = null;
    try {
        localStorage.removeItem(KEY);
    } catch {
        // Nothing to clear if nothing could be written.
    }
};
