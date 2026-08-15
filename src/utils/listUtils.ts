import { Film, filmData } from '../types/film';
import {
    FilmListDefinition,
    FilmListEntry,
    ListFilmSummary,
    filmLists,
    listFilmSummaries,
} from '../types/list';

/**
 * A list entry with its display metadata filled in from whichever source knows
 * about the film.
 *
 * `clubFilm` is the single sanctioned crossover between list data and club data
 * (see the note at the top of `types/list.ts`): it is present only when the id
 * genuinely resolves in `films.json`, and it is what lets the entry link to
 * `/films/:imdbId` and show a club average. A list-only film leaves it
 * undefined and links out to IMDb instead.
 */
export interface ResolvedListEntry {
    rank: number;
    imdbID: string;
    description: string | null;
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
export interface ListDataSources {
    lists?: FilmListDefinition[];
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
 * Every list owned by a member, in creation order. Owner matching is
 * case-insensitive because `lists.json` stores the display name while callers
 * may hold either that or a normalized rating key.
 */
export const getListsForMember = (
    name: string | undefined | null,
    sources: ListDataSources = {}
): FilmListDefinition[] => {
    if (!name) return [];
    const normalized = name.trim().toLowerCase();
    if (!normalized) return [];

    return (sources.lists ?? filmLists).filter(
        (list) => list.owner.trim().toLowerCase() === normalized
    );
};

/** Looks up a list by its stable slug. Undefined for an unknown id. */
export const getListById = (
    id: string | undefined | null,
    sources: ListDataSources = {}
): FilmListDefinition | undefined => {
    if (!id) return undefined;
    return (sources.lists ?? filmLists).find((list) => list.id === id);
};

/**
 * Fills in an entry's display metadata, preferring the full club record so club
 * films can link to their detail page, then the summary cache, and finally
 * degrading to a title-less placeholder. It never throws on an unknown id: a
 * list is member-authored data and one unresolvable film should cost that entry
 * its poster, not the whole page.
 */
export const resolveListEntry = (
    entry: FilmListEntry,
    sources: ListDataSources = {}
): ResolvedListEntry => {
    const clubFilm = indexFilms(sources.films ?? filmData).get(entry.imdbID);
    const base = {
        rank: entry.rank,
        imdbID: entry.imdbID,
        description: entry.description ?? null,
    };

    if (clubFilm) {
        return {
            ...base,
            title: clubFilm.title,
            year: clubFilm.year ?? null,
            poster: clubFilm.poster ?? null,
            clubFilm,
        };
    }

    const summary = (sources.summaries ?? listFilmSummaries)[entry.imdbID];
    if (summary) {
        return {
            ...base,
            title: summary.title,
            year: summary.year ?? null,
            poster: summary.poster ?? null,
        };
    }

    // Not yet enriched (a save that hasn't been through CI) or an id that OMDB
    // doesn't know. The row still renders, with its rank and note intact.
    return { ...base, title: null, year: null, poster: null };
};

/** Resolves every entry on a list, in rank order. */
export const resolveListEntries = (
    list: FilmListDefinition,
    sources: ListDataSources = {}
): ResolvedListEntry[] =>
    [...list.entries]
        .sort((a, b) => a.rank - b.rank)
        .map((entry) => resolveListEntry(entry, sources));
