import listsData from '../assets/lists.json';
import listFilmsData from '../assets/listFilms.json';

/**
 * Member-curated film lists.
 *
 * These are personal rankings ("Andy's Top 10 Horror Films"), not club data.
 * The films on them are mostly films the club never watched, which is why their
 * poster/title metadata lives in its own cache ({@link ListFilmSummary}) rather
 * than in `films.json`.
 *
 * **List films must never be treated as club films.** Every club-film surface —
 * the almanac, the films page, the stat utilities — reads the single `filmData`
 * export from `./film`, which imports `films.json` and nothing else.
 * `ListFilmSummary` is deliberately *not* `Film` or `Partial<Film>`, so a
 * list-only record cannot be handed to anything that expects a club film; the
 * compiler catches it. The one sanctioned crossover is
 * `ResolvedListEntry.clubFilm`, which is populated only when an id genuinely
 * resolves in `films.json`.
 */

/** One film on a list. `rank` is 1-based and positional — reordering renumbers. */
export interface FilmListEntry {
    rank: number;
    imdbID: string;
    /** Optional Markdown note about this pick. */
    description: string | null;
}

/** A single member-curated list. */
export interface FilmListDefinition {
    /** Stable slug used as the URL segment. Assigned on create, never changes. */
    id: string;
    name: string;
    /** A `club.json` member name. */
    owner: string;
    /** Optional Markdown blurb about the list as a whole. */
    description: string | null;
    entries: FilmListEntry[];
}

/**
 * Thin poster/title record for a film that appears on a list but is not a club
 * film. Deliberately a small subset of the OMDB fields — no cast, keywords, or
 * backdrops — and deliberately *not* assignable to {@link Film}.
 */
export interface ListFilmSummary {
    imdbID: string;
    title: string;
    year: string | null;
    poster: string | null;
    runtime?: string | null;
    genre?: string | null;
    director?: string | null;
}

/**
 * Validates the shape of the bundled lists at module-load time.
 *
 * Same reasoning as `assertFilmData` in `./film`: `lists.json` is written by the
 * editor worker and `listFilms.json` is generated in CI, so both are untyped at
 * import and a malformed record would otherwise surface as an opaque crash deep
 * in a render. Intentionally shallow — it checks the fields the app routes and
 * renders on, not the full schema (the worker validates on write).
 */
function assertListData(data: unknown): FilmListDefinition[] {
    if (!Array.isArray(data)) {
        throw new Error('lists.json: expected an array of lists');
    }

    data.forEach((list, index) => {
        if (typeof list !== 'object' || list === null) {
            throw new Error(`lists.json[${index}]: expected an object`);
        }
        const l = list as Partial<FilmListDefinition>;
        if (typeof l.id !== 'string' || l.id.length === 0) {
            throw new Error(`lists.json[${index}]: missing or invalid "id"`);
        }
        if (typeof l.name !== 'string' || l.name.length === 0) {
            throw new Error(`lists.json[${index}] (${l.id}): missing or invalid "name"`);
        }
        if (typeof l.owner !== 'string' || l.owner.length === 0) {
            throw new Error(`lists.json[${index}] (${l.id}): missing or invalid "owner"`);
        }
        if (!Array.isArray(l.entries)) {
            throw new Error(`lists.json[${index}] (${l.id}): "entries" must be an array`);
        }
        (l.entries as unknown[]).forEach((entry, entryIndex) => {
            const e = entry as Partial<FilmListEntry> | null;
            if (typeof e !== 'object' || e === null || typeof e.imdbID !== 'string') {
                throw new Error(
                    `lists.json[${index}] (${l.id}): entry ${entryIndex} missing or invalid "imdbID"`
                );
            }
        });
    });

    return data as FilmListDefinition[];
}

/** Validates the bundled summary cache. Keyed by IMDb id. */
function assertListFilmData(data: unknown): Record<string, ListFilmSummary> {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        throw new Error('listFilms.json: expected an object keyed by IMDb id');
    }

    Object.entries(data as Record<string, unknown>).forEach(([imdbID, summary]) => {
        if (typeof summary !== 'object' || summary === null) {
            throw new Error(`listFilms.json[${imdbID}]: expected an object`);
        }
        const s = summary as Partial<ListFilmSummary>;
        if (typeof s.title !== 'string' || s.title.length === 0) {
            throw new Error(`listFilms.json[${imdbID}]: missing or invalid "title"`);
        }
    });

    return data as Record<string, ListFilmSummary>;
}

export const filmLists = assertListData(listsData);
export const listFilmSummaries = assertListFilmData(listFilmsData);
