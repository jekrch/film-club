import { Film, filmData } from '../types/film';
import { ListFilmSummary, listFilmSummaries } from '../types/list';
import { WatchedEntry, WatchedLog, watchedLog } from '../types/watched';

/**
 * A watch-log entry with its display metadata filled in.
 *
 * `clubFilm` is the same sanctioned crossover `ResolvedListEntry` has, and it
 * carries the same meaning: present only when the id genuinely resolves in
 * `films.json`, which is what lets the row link to `/films/:imdbId`. It does
 * *not* make the entry a club record — the score and review on this object are
 * the member's own and never feed a club average. A film the club never watched
 * leaves it undefined and links out to IMDb.
 */
export interface ResolvedWatchedEntry extends WatchedEntry {
    /** Null when neither films.json nor the summary cache knows this id. */
    title: string | null;
    year: string | null;
    poster: string | null;
    clubFilm?: Film;
}

/**
 * Optional data overrides. Production callers pass nothing and get the bundled
 * data; tests pass fixtures rather than reaching for module mocks.
 */
export interface WatchedDataSources {
    watched?: WatchedLog;
    films?: Film[];
    summaries?: Record<string, ListFilmSummary>;
}

/** Lazy index of the bundled club films, so entry resolution isn't a linear scan. */
let bundledFilmIndex: Map<string, Film> | null = null;

const indexFilms = (films: Film[]): Map<string, Film> => {
    if (films === filmData) {
        bundledFilmIndex ??= new Map(filmData.map((film) => [film.imdbID, film]));
        return bundledFilmIndex;
    }
    return new Map(films.map((film) => [film.imdbID, film]));
};

/**
 * Newest watch first, ties broken on `imdbID`.
 *
 * Duplicated from the worker's `sortWatched` rather than shared, for the same
 * reason the types are: the worker deploys on its own and has no build-time
 * link to this bundle. The site sorts anyway instead of trusting file order —
 * an entry saved a minute ago arrives from the API, not from the bundle, and
 * has to land in the right place on a page that is already rendered.
 */
export const compareWatched = (a: WatchedEntry, b: WatchedEntry): number =>
    a.watchDate === b.watchDate
        ? a.imdbID.localeCompare(b.imdbID)
        : b.watchDate.localeCompare(a.watchDate);

/**
 * One member's log, most recent viewing first. Owner matching is
 * case-insensitive because `watched.json` is keyed by display name while
 * callers may hold either that or a normalized rating key.
 */
export const getWatchedForMember = (
    name: string | undefined | null,
    sources: WatchedDataSources = {}
): WatchedEntry[] => {
    if (!name) return [];
    const normalized = name.trim().toLowerCase();
    if (!normalized) return [];

    const log = sources.watched ?? watchedLog;
    const key = Object.keys(log).find((owner) => owner.trim().toLowerCase() === normalized);
    return key === undefined ? [] : [...log[key]].sort(compareWatched);
};

/**
 * Fills in an entry's display metadata, preferring the full club record so a
 * film the club also watched can link to its detail page, then the summary
 * cache, and finally degrading to a title-less placeholder. It never throws on
 * an unknown id: an entry logged a minute ago has not been through the CI step
 * that fetches its poster, and that should cost the row its artwork, not the
 * whole page.
 */
export const resolveWatchedEntry = (
    entry: WatchedEntry,
    sources: WatchedDataSources = {}
): ResolvedWatchedEntry => {
    const clubFilm = indexFilms(sources.films ?? filmData).get(entry.imdbID);
    if (clubFilm) {
        return {
            ...entry,
            title: clubFilm.title,
            year: clubFilm.year ?? null,
            poster: clubFilm.poster ?? null,
            clubFilm,
        };
    }

    const summary = (sources.summaries ?? listFilmSummaries)[entry.imdbID];
    if (summary) {
        return { ...entry, title: summary.title, year: summary.year ?? null, poster: summary.poster ?? null };
    }

    return { ...entry, title: null, year: null, poster: null };
};

/** Resolves a whole log, in watch order. */
export const resolveWatchedEntries = (
    entries: WatchedEntry[],
    sources: WatchedDataSources = {}
): ResolvedWatchedEntry[] =>
    [...entries].sort(compareWatched).map((entry) => resolveWatchedEntry(entry, sources));

/**
 * `2026-08-09` → `Aug 9, 2026`.
 *
 * Formatted from the parts rather than through `new Date('2026-08-09')`, which
 * parses as UTC midnight and renders as the *previous* day for anyone west of
 * Greenwich — the club is in the US, so that would be wrong for every entry.
 */
export const formatWatchDate = (watchDate: string): string => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(watchDate);
    if (!match) return watchDate;

    const [, year, month, day] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (Number.isNaN(date.getTime())) return watchDate;

    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

/** The club's `7.5d` convention, for a score that may have a qualifier or be unset. */
export const formatWatchedScore = (entry: {
    score: number | null;
    scoreQualifier: string | null;
}): string | null => (entry.score === null ? null : `${entry.score}${entry.scoreQualifier ?? ''}`);
