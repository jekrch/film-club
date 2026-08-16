import { Film, filmData } from '../types/film';
import {
    FilmListDefinition,
    FilmListEntry,
    ListFilmSummary,
    filmLists,
    listFilmSummaries,
} from '../types/list';
import type { WatchedLog } from '../types/watched';
import { pendingFilmSummary } from './pendingFilmSummaries';
import { getWatchedEntryFor } from './watchedUtils';

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
    /** The member's own background art for this row, if they set one. */
    image: string | null;
    /** Null when neither films.json nor the summary cache knows this id. */
    title: string | null;
    year: string | null;
    /**
     * The poster to draw: the member's own if they set one, otherwise the
     * film's. Resolved here rather than at each row so every surface that shows
     * this entry — the list, a profile card, the wash behind it — shows the
     * same poster. Null when there is neither.
     */
    poster: string | null;
    clubFilm?: Film;
    /** The owner's score for this film out of 9, from wherever they gave it. */
    score: number | null;
    /** Where {@link score} came from; null when they have no score for it. */
    scoreSource: ScoreSource | null;
}

/**
 * Where a resolved score was found, in the order they are consulted.
 *
 * - `entry` — set on the list itself, which is the owner saying "on *this* list,
 *   this film is an 8" and therefore wins.
 * - `log` — their `watched.json` entry for the film.
 * - `club` — their row in the film's `clubRatings`.
 */
export type ScoreSource = 'entry' | 'log' | 'club';

/**
 * Optional data overrides. Production callers pass nothing and get the bundled
 * data; tests pass fixtures rather than reaching for module mocks.
 */
export interface ListDataSources {
    lists?: FilmListDefinition[];
    films?: Film[];
    summaries?: Record<string, ListFilmSummary>;
    /** Consulted only for the score fallback below. */
    watched?: WatchedLog;
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
 * The owner's score for one film, and where it came from.
 *
 * A member who has already scored a film shouldn't have to score it again to
 * put it on a list, so a list entry with no score of its own borrows one: their
 * personal watch first, then their club rating. The two are different things —
 * one is a private viewing, the other counts toward club averages — but as *this
 * member's opinion of this film* they are interchangeable, which is what the
 * list row is showing.
 *
 * A score set on the entry wins over both. It is the only one of the three
 * written *about the list*, so it is the only one that can say "here, it's an
 * 8", and it must not be silently displaced the day the owner logs the film.
 */
const resolveScore = (
    entry: FilmListEntry,
    owner: string | undefined,
    clubFilm: Film | undefined,
    sources: ListDataSources
): Pick<ResolvedListEntry, 'score' | 'scoreSource'> => {
    if (entry.score !== null && entry.score !== undefined) {
        return { score: entry.score, scoreSource: 'entry' };
    }

    const logged = getWatchedEntryFor(owner, entry.imdbID, { watched: sources.watched });
    if (logged?.score !== null && logged?.score !== undefined) {
        return { score: logged.score, scoreSource: 'log' };
    }

    const clubRating = owner
        ? clubFilm?.movieClubInfo?.clubRatings.find(
              (rating) => rating.user.trim().toLowerCase() === owner.trim().toLowerCase()
          )
        : undefined;
    if (clubRating?.score !== null && clubRating?.score !== undefined) {
        return { score: clubRating.score, scoreSource: 'club' };
    }

    return { score: null, scoreSource: null };
};

/**
 * Fills in an entry's display metadata, preferring the full club record so club
 * films can link to their detail page, then the summary cache, and finally
 * degrading to a title-less placeholder. It never throws on an unknown id: a
 * list is member-authored data and one unresolvable film should cost that entry
 * its poster, not the whole page.
 *
 * `owner` is the list's owner, and only the score fallback uses it: whose score
 * a row shows is a property of the list, not of the entry. Omit it and the row
 * resolves to the entry's own score or none.
 */
export const resolveListEntry = (
    entry: FilmListEntry,
    sources: ListDataSources = {},
    owner?: string
): ResolvedListEntry => {
    const clubFilm = indexFilms(sources.films ?? filmData).get(entry.imdbID);
    const base = {
        rank: entry.rank,
        imdbID: entry.imdbID,
        description: entry.description ?? null,
        image: entry.image ?? null,
        ...resolveScore(entry, owner, clubFilm, sources),
    };

    // The member's own poster displaces whatever the film has, including a club
    // film's — this entry is their row on their list, and unlike a score it
    // makes no claim the club has a stake in. `films.json` is untouched either
    // way: nothing here writes back.
    const posterOverride = entry.posterImage ?? null;

    if (clubFilm) {
        return {
            ...base,
            title: clubFilm.title,
            year: clubFilm.year ?? null,
            poster: posterOverride ?? clubFilm.poster ?? null,
            clubFilm,
        };
    }

    // The bundled cache first, then whatever the search hit that added this film
    // knew — which is all there is between adding a film and the CI step that
    // enriches it, and is why a row added a minute ago has a title at all.
    const summary =
        (sources.summaries ?? listFilmSummaries)[entry.imdbID] ?? pendingFilmSummary(entry.imdbID);
    if (summary) {
        return {
            ...base,
            title: summary.title,
            year: summary.year ?? null,
            poster: posterOverride ?? summary.poster ?? null,
        };
    }

    // An id OMDB doesn't know, or one added from another device. The row still
    // renders, with its rank and note intact — and with the member's poster,
    // which is the one case where it is the only artwork the row has.
    return { ...base, title: null, year: null, poster: posterOverride };
};

/**
 * Resolves every entry on a list, in rank order.
 *
 * Rank order holds whether or not the list is a ranking: an unranked list drops
 * the numerals, not the arrangement its owner chose.
 */
export const resolveListEntries = (
    list: FilmListDefinition,
    sources: ListDataSources = {}
): ResolvedListEntry[] =>
    [...list.entries]
        .sort((a, b) => a.rank - b.rank)
        .map((entry) => resolveListEntry(entry, sources, list.owner));
