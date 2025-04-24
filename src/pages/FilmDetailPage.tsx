import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Film } from '../types/film';
import filmsData from '../assets/films.json';
import { calculateClubAverage } from '../utils/ratingUtils';
import FilmList from '../components/films/FilmList';
import CircularImage from '../components/common/CircularImage';
import PopcornRating from '../components/common/PopcornRating';

/**
 * Parses a comma-separated string of genres into an array of strings.
 * Handles null, undefined, non-string inputs, and trims whitespace.
 * @param genreString - The string containing genres.
 * @returns An array of genre strings, or an empty array if input is invalid.
 */
const parseGenres = (genreString: string): string[] => {
  if (!genreString || typeof genreString !== 'string') return [];
  return genreString.split(',').map(g => g.trim()).filter(g => g);
};

/**
 * Formats a runtime string (e.g., "120 min") into a more readable format (e.g., "2h 0m").
 * Handles invalid or missing "min" suffix and non-numeric inputs.
 * @param runtimeString - The runtime string (expected to include " min").
 * @returns Formatted runtime string (e.g., "1h 30m") or null if input is invalid.
 */
const formatRuntime = (runtimeString: string): string | null => {
  if (!runtimeString || typeof runtimeString !== 'string' || !runtimeString.includes('min')) {
    return null;
  }
  // Extract numeric part, ignoring potential non-numeric characters before " min"
  const minutes = parseInt(runtimeString);
  if (isNaN(minutes)) {
    return null;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  // Construct the display string
  let result = '';
  if (hours > 0) {
    result += `${hours}h `;
  }
  result += `${mins}m`;
  return result.trim(); // Trim potential trailing space if hours is 0
};

/**
 * Formats the IMDb rating string for display.
 * Handles "N/A" and attempts to parse the rating as a float, formatting to one decimal place.
 * @param rating - The IMDb rating string.
 * @returns The formatted rating string (e.g., "7.8") or null if "N/A" or parsing fails.
 */
const getImdbRatingDisplay = (rating: string): string | null => {
  if (rating === 'N/A') return null;
  const parsed = parseFloat(rating);
  return isNaN(parsed) ? null : parsed.toFixed(1);
};

/**
 * Renders the detailed view page for a specific film.
 * Fetches film data based on the imdbId from the URL parameters,
 * displays film details, club ratings, and related films by the same selector.
 */
const FilmDetailPage = () => {
  const { imdbId } = useParams<{ imdbId: string }>();
  const navigate = useNavigate();
  const [film, setFilm] = useState<Film | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filmsBySameSelector, setFilmsBySameSelector] = useState<Film[]>([]);
  const [isPlotExpanded, setIsPlotExpanded] = useState(false);

  useEffect(() => {
    // Reset state and scroll to top on imdbId change
    window.scrollTo(0, 0);
    setIsPlotExpanded(false);
    setFilm(null);
    setFilmsBySameSelector([]);
    setLoading(true);
    setError(null);

    if (!imdbId) {
      setError("Film ID is missing in the URL.");
      setLoading(false);
      return;
    }

    // Load all films from the static JSON data
    const allFilms = filmsData as unknown as Film[];
    const foundFilm = allFilms.find(f => f.imdbID === imdbId);

    if (!foundFilm) {
      setError(`Film with ID ${imdbId} not found.`);
      setLoading(false);
      return;
    }

    setFilm(foundFilm);

    // Find other films selected by the same person
    const currentSelector = foundFilm.movieClubInfo?.selector;
    if (currentSelector) {
      const otherFilms = allFilms
        .filter(otherFilm =>
          otherFilm.imdbID !== imdbId &&
          otherFilm.movieClubInfo?.selector === currentSelector
        )
        .sort((a, b) => {
          const dateA = a.movieClubInfo?.watchDate ? new Date(a.movieClubInfo.watchDate).getTime() : 0;
          const dateB = b.movieClubInfo?.watchDate ? new Date(b.movieClubInfo.watchDate).getTime() : 0;
          if (dateB !== dateA) return dateB - dateA;
          return a.title.localeCompare(b.title);
        });
      setFilmsBySameSelector(otherFilms);
    } else {
      setFilmsBySameSelector([]);
    }

    setLoading(false);
  }, [imdbId]);

  // --- Loading State ---
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-900">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
      </div>
    );
  }

  // --- Error State ---
  if (error || !film) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center bg-slate-900 text-slate-300 min-h-screen">
        <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded relative mb-6 inline-block" role="alert">
          <strong className="font-bold block sm:inline">Error: </strong>
          <span className="block sm:inline">{error || "Could not load film details."}</span>
        </div>
        <div>
          <button onClick={() => navigate('/films')} className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium">
            Back to Films List
          </button>
        </div>
      </div>
    );
  }

  // --- Calculations for Display ---
  const filmGenres = parseGenres(film.genre);
  const runtimeDisplay = formatRuntime(film.runtime);
  const clubAverageDisplay = calculateClubAverage(film.movieClubInfo?.clubRatings);
  const imdbRatingDisplay = getImdbRatingDisplay(film.imdbRating);
  const selectorName = film.movieClubInfo?.selector;
  const capitalizeFirstLetter = (str: string): string => {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  // --- Popcorn Rating Calculation ---
  const MAX_RATING = 9;
  const numericClubRating = clubAverageDisplay ? parseFloat(clubAverageDisplay) : NaN;

  return (
    <div className="bg-slate-900 text-slate-300 min-h-screen py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back button */}
        <button onClick={() => navigate(-1)} className="mb-6 inline-flex items-center text-blue-400 hover:text-blue-300 transition-colors group">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1 transition-transform group-hover:-translate-x-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
          Back
        </button>

        {/* Film Detail Section */}
        <div className="bg-slate-800 rounded-lg shadow-xl overflow-hidden mb-12 border border-slate-700">
          <div className="md:flex">
            {/* Poster */}
            <div className="md:flex-shrink-0 md:w-1/3 lg:w-[300px]">
              <img
                src={film.poster}
                alt={`${film.title} poster`}
                className="h-full w-full object-cover"
                onError={(e) => { e.currentTarget.src = '/placeholder-poster.png'; }}
              />
            </div>

            {/* Film Details */}
            <div className="p-6 md:p-8 flex-grow">
              {/* Title and Year */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3">
                <h1 className="text-3xl lg:text-4xl font-bold text-slate-100 mb-1 sm:mb-0 pr-4">{film.title}</h1>
                <span className="text-xl font-semibold text-slate-400 flex-shrink-0">({film.year})</span>
              </div>

              {/* Metadata Display */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-400 mb-5">
                 {/* Club Average Rating */}
                 {clubAverageDisplay && (
                  <div className="flex items-center font-medium text-base" title="Average Club Rating">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400 mr-1.5" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg>
                    <span className="text-slate-200">{clubAverageDisplay}</span><span className="ml-1 text-slate-500">/ {MAX_RATING}</span> <span className="ml-1 text-xs">(Club Avg)</span>
                  </div>
                )}
                {runtimeDisplay && <span className="border-l border-slate-600 pl-4">{runtimeDisplay}</span>}
                {film.rated !== 'N/A' && <span className="border-l border-slate-600 pl-4">{film.rated}</span>}
                {imdbRatingDisplay && (
                  <span className="border-l border-slate-600 pl-4 flex items-center text-xs text-slate-500" title="IMDb Rating">
                    IMDb: {imdbRatingDisplay}/10
                  </span>
                )}
              </div>

              {/* Plot */}
              <div className="mb-5 text-slate-300">
                <p className={isPlotExpanded ? '' : 'line-clamp-3'}>{film.plot}</p>
                {film.plot && film.plot.length > 150 && (
                  <button
                    onClick={() => setIsPlotExpanded(!isPlotExpanded)}
                    className="text-blue-400 hover:text-blue-300 text-sm font-medium mt-2"
                  >
                    {isPlotExpanded ? 'Read Less' : 'Read More'}
                  </button>
                )}
              </div>

              {/* Director, Writer, Stars, Language, Country - **TWO COLUMN GRID** */}
              {/* Uses grid layout: 1 column on small screens, 2 columns on medium screens and up */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm mb-5">
                {/* Director */}
                {film.director && film.director !== 'N/A' && (
                  <div>
                    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Director</h2>
                    <p className="text-slate-300">{film.director}</p>
                  </div>
                )}
                {/* Writer */}
                {film.writer && film.writer !== 'N/A' && (
                  <div>
                    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Writer</h2>
                    <p className="text-slate-300">{film.writer}</p>
                  </div>
                )}
                 {/* Stars */}
                 {film.actors && film.actors !== 'N/A' && (
                    // Make Stars potentially span two columns if it's the last prominent item before Language/Country
                    // You might adjust this based on how many items typically appear.
                    // If Language/Country are always present, remove col-span-1 md:col-span-2
                  <div className="col-span-1 md:col-span-2"> {/* Example: Let Stars take full width if needed */}
                    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Stars</h2>
                    <p className="text-slate-300">{film.actors}</p>
                  </div>
                )}
                 {/* Language */}
                 {film.language && film.language !== 'N/A' && (
                  <div>
                    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Language</h2>
                    <p className="text-slate-300">{film.language}</p>
                  </div>
                )}
                {/* Country */}
                {film.country && film.country !== 'N/A' && (
                  <div>
                    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Country</h2>
                    <p className="text-slate-300">{film.country}</p>
                  </div>
                )}
              </div> {/* End Grid */}

              {/* Genres */}
              {filmGenres.length > 0 && (
                <div className="mt-5">
                  <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Genres</h2>
                  <div className="flex flex-wrap gap-2">
                    {filmGenres.map((genre) => (
                      <span key={genre} className="px-3 py-1 bg-slate-700 text-blue-300 text-xs font-medium rounded-full">{genre}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Movie Club Info Section */}
          {film.movieClubInfo && (
             <div className="bg-slate-850 border-t-2 border-blue-700 p-6 md:p-8">
              <h2 className="text-2xl font-semibold text-slate-100 mb-6">Film Club Facts</h2>

              <div className="md:flex md:justify-between md:items-start">
                {/* Left side - Watch Date and Ratings */}
                <div className="flex-1 mb-6 md:mb-0 md:pr-6">
                  {/* Watch Date */}
                  <div className="mb-6">
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider block mb-1">Watch Date</span>
                    <span className="text-slate-200 text-lg">
                      {film.movieClubInfo.watchDate ?? <span className="italic text-slate-400">Not Watched Yet</span>}
                    </span>
                  </div>

                  {/* Club Ratings Section */}
                  {clubAverageDisplay && !isNaN(numericClubRating) && (
                    <div>
                      <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">Club Rating</h3>
                      {/* Average Rating Display */}
                      <div className="mb-5 flex items-center gap-x-4 gap-y-2 flex-wrap">
                        <div className="flex items-baseline whitespace-nowrap">
                          <span className="text-4xl font-bold text-blue-300">{clubAverageDisplay}</span>
                          <span className="text-slate-400 text-lg"> / {MAX_RATING}</span>
                        </div>
                        {/* Popcorn Icons for Average */}
                        <PopcornRating
                          rating={numericClubRating}
                          maxRating={MAX_RATING}
                          size="regular"
                          title={`Average rating: ${clubAverageDisplay} out of ${MAX_RATING}`}
                        />
                      </div>

                      {/* Individual Ratings */}
                      <h4 className="text-sm font-semibold text-slate-300 mb-3 mt-4">Individual Ratings:</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                        {Object.entries(film.movieClubInfo.clubRatings)
                          .filter(([, rating]) => rating !== null && typeof rating === 'number')
                          .sort(([memberA], [memberB]) => memberA.localeCompare(memberB))
                          .map(([member, rating]) => (
                            <div key={member} className="flex items-center space-x-2">
                              <Link
                                to={`/profile/${encodeURIComponent(capitalizeFirstLetter(member))}`}
                                className="text-slate-300 hover:text-white transition font-medium capitalize w-16 truncate"
                                title={capitalizeFirstLetter(member)}
                              >
                                {member}:
                              </Link>
                              <span className="font-semibold text-slate-200 w-8 text-right">{rating}</span>
                              <PopcornRating
                                rating={rating as number}
                                maxRating={MAX_RATING}
                                size="small"
                                title={`${capitalizeFirstLetter(member)}'s rating: ${rating} out of ${MAX_RATING}`}
                              />
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right side - Selector with Banner */}
                {selectorName && (
                  <Link
                    to={`/profile/${encodeURIComponent(capitalizeFirstLetter(selectorName))}`}
                    className="flex flex-col items-center md:ml-8 md:flex-shrink-0"
                    title={`View ${capitalizeFirstLetter(selectorName)}'s profile`}
                  >
                    <div className="relative group mb-2">
                      <CircularImage
                        alt={capitalizeFirstLetter(selectorName)}
                        size="w-32 h-32 md:w-36 md:h-36"
                      />
                      {/* Tilted Banner */}
                      <div
                        className="absolute bottom-0 transform -translate-x-1/2 translate-y-1/4 bg-emerald-600 text-slate-100 px-4 py-1 rounded text-base font-semibold whitespace-nowrap shadow-lg group-hover:scale-105 transition-transform"
                        style={{
                          transform: 'translateX(55%) translateY(5%) rotate(-7deg)',
                          transformOrigin: 'center bottom'
                        }}
                      >
                        {capitalizeFirstLetter(selectorName)}'s Pick
                      </div>
                    </div>
                  </Link>
                )}
              </div>

              {/* Trophy Info - Compact Display */}
              {(film.movieClubInfo.trophyInfo || film.movieClubInfo.trophyNotes) && (
                <div className="mt-8 pt-6 border-t border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  {film.movieClubInfo.trophyInfo && (
                    <div>
                      <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">Trophy Info</h3>
                      <p className="text-slate-300">{film.movieClubInfo.trophyInfo}</p>
                    </div>
                  )}
                  {film.movieClubInfo.trophyNotes && (
                    <div>
                       <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">Trophy Notes</h3>
                       <p className="text-slate-300">{film.movieClubInfo.trophyNotes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Other Films by Selector Section */}
        {selectorName && filmsBySameSelector.length > 0 && (
          <div className="mb-12">
            <FilmList
              films={filmsBySameSelector}
              title={`More Films Selected by ${capitalizeFirstLetter(selectorName)}`}
            />
          </div>
        )}

      </div>
    </div>
  );
};

export default FilmDetailPage;