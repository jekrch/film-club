
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

// Film.ts

/**
 * Represents the rating given by a specific source (e.g., IMDB, Rotten Tomatoes).
 */
export interface Rating {
    source: string;
    value: string;
}

/**
 * Represents the ratings given by the movie club members.
 * Scores are out of 9, or null if not rated.
 */
export interface ClubMemberRatings {
    andy: number | null;
    gabe: number | null;
    jacob: number | null;
    joey: number | null;
    mark: number | null;
}

/**
 * Represents the specific details tracked by the movie club for a film.
 */
export interface MovieClubDetails {
    selector: string; // Who chose the movie
    watchDate: string | null; // Date the movie was reviewed/discussed (or null if not yet reviewed) e.g. 10/11/2025
    clubRatings: ClubMemberRatings; // Individual scores from members
    trophyInfo?: string; // Optional: Main description or recipient of the togetherness trophy
    trophyNotes?: string; // Optional: Additional notes or recipients for trophies/awards
}

/**
 * Represents a single Film entry, combining general movie data
 * with specific movie club tracking information.
 */
export interface Film {
    title: string;
    year: string;
    rated: string;
    released: string;
    runtime: string;
    genre: string;
    director: string;
    writer: string;
    actors: string;
    plot: string;
    language: string;
    country: string;
    awards: string;
    poster: string; // URL
    ratings: Rating[]; // Array of ratings from different sources
    metascore: string; // Can be "N/A"
    imdbRating: string; // Can be "N/A"
    imdbVotes: string; // Can be "N/A"
    imdbID: string;
    type: string; // e.g., "movie", "series"
    dvd: string; // Often "N/A"
    boxOffice: string; // Often "N/A"
    production: string; // Often "N/A"
    website: string; // Often "N/A"
    streamUrl?: string; // Optional: URL for streaming the film
    noStreaming?: boolean; // Optional: Flag to indicate if the film is not available for streaming
    // Optional: Movie club specific information added from your CSV
    // Make it optional in case some films in your list haven't been processed by the club yet.
    movieClubInfo?: MovieClubDetails;
}
