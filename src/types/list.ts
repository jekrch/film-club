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

/**
 * One film on a list. `rank` is 1-based and positional — reordering renumbers.
 *
 * A list always has an order; {@link FilmListDefinition.ranked} decides only
 * whether that order is *numbered* when it renders.
 */
export interface FilmListEntry {
    rank: number;
    imdbID: string;
    /** Optional Markdown note about this pick. */
    description: string | null;
    /**
     * The owner's score for this pick, out of 9 — the club's scale, since a
     * member scoring a film on their list is doing the same thing they do in the
     * club, alone.
     *
     * Null or absent means they set none *here*, which is the common case: the
     * score then comes from wherever they already gave the film one — their
     * watch log, then their club rating. `resolveListEntry` does that fallback,
     * so nobody has to retype a score they have already given.
     */
    score?: number | null;
    /**
     * An `https` image the member picked for this row's background art, or null
     * to use whatever the film already has. Absent on entries written before the
     * field existed, which is why readers treat it as optional.
     *
     * This is the only way a list-only film gets scene art: the summary cache
     * holds a poster and nothing else.
     */
    image?: string | null;
    /**
     * An `https` image the member picked as this film's poster, or null to use
     * the one OMDB supplied. Absent on entries written before the field
     * existed, for the same reason {@link image} may be.
     *
     * Separate from {@link image} because the two are framed differently and
     * fail differently: this one stands in for the poster everywhere the row
     * draws one, at poster proportions, while `image` is wide art washed behind
     * it. A member wanting a better poster — the cache holds whatever OMDB had,
     * which for an obscure film is often nothing or the wrong edition — should
     * not have to accept a portrait image stretched across the row's background
     * to get one.
     */
    posterImage?: string | null;
    /**
     * A YouTube video key the member picked as this film's trailer, or null to
     * play whatever trailer the film itself has. Absent on entries written
     * before the field existed, like the two image fields above.
     *
     * Stored as a key rather than a URL because it is interpolated into an embed
     * address; `parseTrailerLink` in `utils/youtube.ts` is what turns a pasted
     * link into one.
     */
    trailerKey?: string | null;
    /**
     * True when the member wants this row to offer no trailer at all — a
     * separate flag rather than a third state of {@link trailerKey} so "I have
     * no better link" and "don't show one" stay distinguishable, which is the
     * difference between a row that improves when CI finds a trailer and a row
     * whose owner has already said no.
     *
     * It wins over {@link trailerKey}: a member who set a link and later hid the
     * trailer keeps the link for whenever they unhide it.
     */
    hideTrailer?: boolean;
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
    /**
     * Whether the order is a *ranking*, i.e. drawn with numerals.
     *
     * An unranked list is still ordered — its owner arranged it, and `rank`
     * still records that arrangement — it simply isn't claiming that the third
     * film beat the fourth. Absent means ranked: every list written before this
     * field existed was a numbered one.
     */
    ranked?: boolean;
    entries: FilmListEntry[];
}

/** A list is a ranking unless it says otherwise. See {@link FilmListDefinition.ranked}. */
export const isRankedList = (list: Pick<FilmListDefinition, 'ranked'>): boolean =>
    list.ranked !== false;

/**
 * One credited actor on a cache film.
 *
 * Carries its own `tmdbId`, which is the difference between this and a club
 * film's `CastMember`: club films resolve a name to an id through their
 * `personProfiles` map, because the club's person modal is keyed by name and
 * shows a cross-club filmography. A cache film's actor has no club filmography
 * to show, so the name links straight out to TMDb instead and the id may as well
 * ride on the entry.
 */
export interface ListCastMember {
    name: string;
    /** The role, when TMDb credits one. */
    character?: string | null;
    /** TMDb headshot. Null for the many actors who have none. */
    profileUrl?: string | null;
    /** What the name links to. Null when TMDb credited a person with no id. */
    tmdbId?: number | null;
}

/**
 * Record for a film that appears on a list or in a watch log but is not a club
 * film: identity from OMDB, and from TMDb the handful of fields a row's expanded
 * panel and its background art need.
 *
 * **Still deliberately thinner than a club film, and deliberately *not*
 * assignable to {@link Film}.** No keywords, no crew, no financials, no
 * `personProfiles` — and the reason is not tidiness. This file is bundled and
 * shipped to every visitor, and unlike `films.json`, which grows by one film per
 * club meeting, this one grows with whatever members add to their lists and
 * logs. Every field here is paid for on the whole cache by everyone who loads
 * the site. Weigh a new one against that, and if it is heavy, split it into a
 * lazily-fetched file rather than adding it here.
 */
export interface ListFilmSummary {
    imdbID: string;
    title: string;
    year: string | null;
    poster: string | null;
    runtime?: string | null;
    genre?: string | null;
    director?: string | null;
    /**
     * The film's own trailer, as a YouTube video key — the same field club films
     * carry in `films.json`, so a row can play a trailer whichever cache it
     * resolved from.
     *
     * Three states, and they are not the same: absent means CI has not looked
     * this film up yet, `null` means it looked and TMDb had no trailer (so it
     * never looks again), and a string is the key. See `enrich_list_films.py`.
     */
    trailerKey?: string | null;
    /** The film's marketing tagline, shown above the summary in a row's panel. */
    tagline?: string | null;
    /**
     * TMDb's overview, named for the club films' own field so one panel
     * component renders either shape.
     */
    plot?: string | null;
    /** Top-billed cast, TMDb's order, capped in CI. */
    cast?: ListCastMember[];
    /**
     * Wide scene art, textless first — what a row washes behind itself when the
     * member set no image of their own. The whole reason a cache film can look
     * like anything but a poster.
     */
    backdropImages?: string[];
    /**
     * Which generation of TMDb fields this summary was filled from. Absent means
     * never enriched; a stamp older than the script's `TMDB_VERSION` means the
     * next deploy refetches it. Not read by the site — it exists so CI can
     * backfill a field added after a film was cached.
     */
    tmdbVersion?: number;
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
