import filmsData from '../assets/films.json';

export const filmData = filmsData as Film[];

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
 * Represents a single rating entry from a movie club member.
 */
export interface ClubRating {
    user: string;       // The name of the club member (e.g., 'andy', 'gabe')
    score: number | null; // The score given (e.g., 8.5), or null if not rated
    blurb: string | null; // An optional short review or comment, null if not provided
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
    // Optional: Movie club specific information.
    movieClubInfo?: MovieClubDetails;
}

export function getClubRating(film: Film, user: string): ClubRating | undefined {
    if (!film.movieClubInfo) return undefined; // No movie club info available

    return film.movieClubInfo.clubRatings.find(rating => rating.user === user);
}