import filmsData from '../assets/films.json';

/**
 * Validates the shape of the bundled films dataset at module-load time.
 *
 * `films.json` is generated from a Google Sheet by the CI sync script, so a
 * malformed row can slip in without any compile-time signal (the JSON import is
 * untyped). This guard surfaces such problems loudly and early instead of as an
 * opaque crash deep in a render. It checks the fields the app actually relies on
 * to key/route/render; it is intentionally shallow, not a full schema.
 */
function assertFilmData(data: unknown): Film[] {
    if (!Array.isArray(data)) {
        throw new Error('films.json: expected an array of films');
    }

    data.forEach((film, index) => {
        if (typeof film !== 'object' || film === null) {
            throw new Error(`films.json[${index}]: expected an object`);
        }
        const f = film as Partial<Film>;
        if (typeof f.imdbID !== 'string' || f.imdbID.length === 0) {
            throw new Error(`films.json[${index}]: missing or invalid "imdbID"`);
        }
        if (typeof f.title !== 'string' || f.title.length === 0) {
            throw new Error(`films.json[${index}] (${f.imdbID}): missing or invalid "title"`);
        }
        if (f.movieClubInfo !== undefined) {
            const info = f.movieClubInfo;
            if (typeof info !== 'object' || info === null || !Array.isArray(info.clubRatings)) {
                throw new Error(
                    `films.json[${index}] (${f.imdbID}): "movieClubInfo.clubRatings" must be an array`
                );
            }
        }
    });

    return data as Film[];
}

export const filmData = assertFilmData(filmsData);

// Interfaces related to component props 
export interface FilmListProps {
    films: Film[];
    onFilmSelect?: (film: Film) => void;
}

export interface FilmCardProps {
    film: Film;
    onClick?: () => void;
}

export interface FilmDetailProps {
    film: Film;
}


// --- Updated Film Data Interfaces ---

/**
 * Represents the rating given by a specific source (e.g., IMDB, Rotten Tomatoes).
 */
export interface Rating {
    source: string;
    value: string;
}

/**
 * Represents a single cast member, sourced from TMDb credits.
 */
export interface CastMember {
    name: string;
    character?: string | null; // The role played, if known
    profileUrl?: string | null; // Full TMDb profile image URL, if available
}

/**
 * Per-film mapping of a credited person to their TMDb identity, keyed by the
 * person's normalized (lowercase, trimmed) name. Lets the UI resolve a displayed
 * name to a stable TMDb id without ambiguity, for person links and the modal.
 * Populated by the sync script from TMDb crew + cast.
 */
export interface PersonProfile {
    tmdbId: number;
    profileUrl?: string | null; // Per-film TMDb headshot, if available
}

/**
 * Normalized biographical record for a single person, keyed by TMDb id in
 * persons.json. Shared across films and fetched once per person by the sync
 * script from TMDb's /person endpoint.
 */
export interface PersonInfo {
    tmdbId: number;
    name: string;
    biography?: string | null;
    birthday?: string | null;
    deathday?: string | null;
    placeOfBirth?: string | null;
    knownForDepartment?: string | null;
    profileUrl?: string | null; // Canonical TMDb headshot
}

/**
 * Represents a single rating entry from a movie club member.
 */
export interface ClubRating {
    user: string;       // The name of the club member (e.g., 'andy', 'gabe')
    score: number | null; // The score given (e.g., 8.5), or null if not rated
    blurb: string | null; // An optional short review or comment, null if not provided
    // Optional single-letter qualifier appended to the score in the sheet (e.g.
    // Joey's "d" on a documentary score in "7.5d"). Extracted by the sync script
    // so `score` stays numeric; the UI restores it with an explanatory note.
    scoreQualifier?: string | null;
}

/**
 * Represents the specific details tracked by the movie club for a film.
 */
export interface MovieClubDetails {
    selector: string;         // Who chose the movie
    watchDate: string | null; // Date the movie was reviewed/discussed (e.g., "10/14/2020"), or null if not yet reviewed
    clubRatings: ClubRating[];// Array of individual ratings from members
    trophyInfo?: string | null; // Optional: Main description or recipient of the togetherness trophy (can be null)
    trophyNotes?: string | null;// Optional: Additional notes or recipients for trophies/awards (can be null)
}

/**
 * Represents a single Film entry, combining general movie data
 * with specific movie club tracking information.
 * Fields that might have contained "N/A" are now optional as they may be removed.
 */
export interface Film {
    title: string;
    year: string;
    rated?: string; // Marked optional as it *could* potentially be "N/A", though less common
    released: string;
    runtime: string;
    genre: string;
    director: string;
    writer: string;
    actors: string;
    plot: string;
    language: string;
    country: string;
    awards?: string; 
    poster: string; // URL
    backdropImage?: string; // Optional: hand-curated wide background/banner image shown behind the selection committee (home) and film details
    backdropImages?: string[]; // Optional: TMDb scene stills (populated by the sync script) used as faded backgrounds; fallback pool when no curated backdropImage exists
    ratings: Rating[]; // Array of ratings from different sources
    metascore?: string; // Optional: Removed if "N/A"
    imdbRating?: string; // Optional: Removed if "N/A"
    imdbVotes?: string; // Optional: Removed if "N/A"
    imdbID: string;
    type: string; // e.g., "movie", "series"
    dvd?: string; // Optional: Removed if "N/A"
    boxOffice?: string; // Optional: Removed if "N/A"
    production?: string; // Optional: Removed if "N/A"
    website?: string; // Optional: Removed if "N/A"
    streamUrl?: string; // Optional: URL for streaming the film
    noStreaming?: boolean; // Optional: Flag to indicate if the film is not available for streaming
    editor?: string;
    productionDesigner?: string;
    cinematographer?: string;
    costumeDesigner?: string;
    musicComposer?: string;
    // --- Extended TMDb data (optional; populated by the sync script) ---
    tagline?: string; // Marketing tagline, e.g. "In space no one can hear you scream."
    budget?: number; // Production budget in USD (0 if unknown)
    revenue?: number; // Worldwide box office in USD per TMDb (0 if unknown)
    keywords?: string[]; // Thematic keywords/tags from TMDb
    trailerKey?: string; // YouTube video key for the primary trailer
    cast?: CastMember[]; // Top-billed cast with characters and profile images
    personProfiles?: Record<string, PersonProfile>; // normalized name -> TMDb identity
    // Optional: Movie club specific information.
    movieClubInfo?: MovieClubDetails;
}

export function getClubRating(film: Film, user: string): ClubRating | undefined {
    if (!film.movieClubInfo) return undefined; // No movie club info available

    return film.movieClubInfo.clubRatings.find(rating => rating.user === user);
}