import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Film, ClubRating } from '../types/film'; 
import filmsData from '../assets/films.json';
import { calculateClubAverage } from '../utils/ratingUtils'; 
import FilmList from '../components/films/FilmList'; 
import CircularImage from '../components/common/CircularImage'; 
import PopcornRating from '../components/common/PopcornRating'; 

// --- Helper Functions (parseGenres, formatRuntime, getImdbRatingDisplay, countValidRatings) ---

/**
 * Parses a comma-separated string of genres into an array of strings.
 * Handles null, undefined, non-string inputs, and trims whitespace.
 * @param genreString - The string containing genres.
 * @returns An array of genre strings, or an empty array if input is invalid.
 */
const parseGenres = (genreString: string | undefined | null): string[] => {
  if (!genreString || typeof genreString !== 'string') return [];
  return genreString.split(',').map(g => g.trim()).filter(g => g);
};

/**
 * Formats a runtime string (e.g., "120 min") into a more readable format (e.g., "2h 0m").
 * Handles invalid or missing "min" suffix and non-numeric inputs.
 * @param runtimeString - The runtime string (expected to include " min").
 * @returns Formatted runtime string (e.g., "1h 30m") or null if input is invalid.
 */
const formatRuntime = (runtimeString: string | undefined | null): string | null => {
  if (!runtimeString || typeof runtimeString !== 'string' || !runtimeString.includes('min')) {
    return null;
  }
  const minutes = parseInt(runtimeString);
  if (isNaN(minutes)) {
    return null;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  let result = '';
  if (hours > 0) {
    result += `${hours}h `;
  }
  result += `${mins}m`;
  return result.trim();
};

/**
 * Formats the IMDb rating string for display.
 * Handles "N/A" and attempts to parse the rating as a float, formatting to one decimal place.
 * @param rating - The IMDb rating string.
 * @returns The formatted rating string (e.g., "7.8") or null if "N/A" or parsing fails.
 */
const getImdbRatingDisplay = (rating: string | undefined | null): string | null => {
  if (!rating || rating === 'N/A') return null;
  const parsed = parseFloat(rating);
  return isNaN(parsed) ? null : parsed.toFixed(1);
};

/**
 * Counts the number of valid (non-null, numeric) ratings in a club ratings array.
 * @param clubRatings - The array containing member ratings.
 * @returns The count of valid ratings.
 */
const countValidRatings = (clubRatings: ClubRating[] | undefined): number => {
  if (!clubRatings || !Array.isArray(clubRatings)) return 0;
  return clubRatings.filter(rating => rating.score !== null && typeof rating.score === 'number' && !isNaN(rating.score)).length;
};
// --- End Helper Functions ---


/**
 * Renders the detailed view page for a specific film.
 * Fetches film data based on the imdbId from the URL parameters,
 * displays film details, club ratings, related films by the same selector,
 * and handles the watch link logic.
 */
const FilmDetailPage = () => {
  const { imdbId } = useParams<{ imdbId: string }>();
  const navigate = useNavigate();
  const [film, setFilm] = useState<Film | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filmsBySameSelector, setFilmsBySameSelector] = useState<Film[]>([]);
  const [isPlotExpanded, setIsPlotExpanded] = useState(false);
  // New state to track expanded blurbs (key: username, value: boolean)
  const [expandedBlurbs, setExpandedBlurbs] = useState<Record<string, boolean>>({});

  // State for the watch link
  const [watchUrl, setWatchUrl] = useState<string | null>(null);
  const [linkCheckStatus, setLinkCheckStatus] = useState<'idle' | 'checking' | 'valid' | 'not_found' | 'error'>('idle');

  // Helper function to generate Criterion Channel URL (remains the same)
  const getCriterionChannelUrl = (title: string): string => {
    const baseUrl = 'https://www.criterionchannel.com/videos/';
    // Basic slugification, might need refinement for edge cases (punctuation, etc.)
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `${baseUrl}${slug}`;
  };

  // Toggle blurb expansion
  const toggleBlurbExpansion = (username: string) => {
    setExpandedBlurbs(prev => ({
      ...prev,
      [username]: !prev[username]
    }));
  };

  useEffect(() => {
    // Reset state and scroll to top on imdbId change
    window.scrollTo(0, 0);
    setIsPlotExpanded(false);
    setFilm(null);
    setFilmsBySameSelector([]);
    setWatchUrl(null); // Reset watch URL state
    setLinkCheckStatus('idle'); // Reset link status
    setLoading(true);
    setError(null);
    setExpandedBlurbs({}); // Reset expanded blurbs state

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

    // --- Watch Link Logic ---
    if (foundFilm.noStreaming) {
      setWatchUrl(null);
      setLinkCheckStatus('not_found');
    } else if (foundFilm.streamUrl?.length) {
      // Use streamUrl if provided
      setWatchUrl(foundFilm.streamUrl);
      setLinkCheckStatus('valid');
    } else if (foundFilm.title && !foundFilm.noStreaming) {
      const potentialUrl = getCriterionChannelUrl(foundFilm.title);
      setLinkCheckStatus('checking');
      setWatchUrl(potentialUrl);
      setLinkCheckStatus('valid');
    }

    // Find other films by the same selector (existing logic)
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
          return (a.title ?? '').localeCompare(b.title ?? '');
        });
      setFilmsBySameSelector(otherFilms);
    } else {
      setFilmsBySameSelector([]);
    }

    setLoading(false);
  }, [imdbId]); // Dependency array remains [imdbId]

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
    // Keep existing error handling
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

  // --- Calculations for Display (remain the same) ---
  const filmGenres = parseGenres(film.genre);
  const runtimeDisplay = formatRuntime(film.runtime);
  const numberOfValidRatings = countValidRatings(film.movieClubInfo?.clubRatings);
  const clubAverageDisplay = numberOfValidRatings >= 2 ? calculateClubAverage(film.movieClubInfo?.clubRatings) : null;
  const imdbRatingDisplay = getImdbRatingDisplay(film.imdbRating);
  const selectorName = film.movieClubInfo?.selector;
  const capitalizeFirstLetter = (str: string): string => {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  };
  const MAX_RATING = 9;
  const numericClubRating = typeof clubAverageDisplay === 'string' ? parseFloat(clubAverageDisplay) : NaN;

  // Determine if the watch link should be rendered
  const canWatch = linkCheckStatus === 'valid' && !!watchUrl;

  return (
    <div className="bg-slate-900 text-slate-300 min-h-screen py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back button (remains the same) */}
        <button onClick={() => navigate(-1)} className="mb-6 inline-flex items-center text-blue-400 hover:text-blue-300 transition-colors group">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1 transition-transform group-hover:-translate-x-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
          Back
        </button>

        {/* Film Detail Section */}
        <div className="bg-slate-800 rounded-lg shadow-xl overflow-hidden mb-12 border border-slate-700">
          <div className="md:flex">
            <div className="md:flex-shrink-0 md:w-1/3 lg:w-[300px] relative group overflow-hidden">
              {/* Image is always displayed */}
              <img
                src={film.poster}
                alt={`${film.title} poster`}
                className="h-full w-full object-cover" // No transition needed here directly
                onError={(e) => { e.currentTarget.src = '/placeholder-poster.png'; e.currentTarget.onerror = null; }}
              />

              {/* Conditionally render the Link structure only if watchUrl is valid */}
              {canWatch && (
                <a
                  href={watchUrl!} // Non-null assertion okay due to canWatch check
                  target="_blank"
                  rel="noopener noreferrer"
                  // Default: Link is NOT clickable (mobile).
                  // Desktop Hover: Link BECOMES clickable (covers whole area).
                  className="absolute inset-0 pointer-events-none md:group-hover:pointer-events-auto"
                  aria-label={`Watch ${film.title}`} // Accessibility
                >
                  {/* Banner/Overlay Container */}
                  <div
                    className={`absolute bottom-0 left-0 right-0
                                    bg-gradient-to-t from-black/80 to-transparent
                                    flex items-end justify-end p-4
                                    transition-opacity duration-300 ease-in-out
                                    h-auto md:h-1/3  /* Mobile height auto, Desktop height 1/3 */
                                    opacity-100 md:opacity-0 md:group-hover:opacity-100 /* Always visible mobile, Hover visible desktop */
                                   `}
                  // No pointer events needed here, handled by the parent 'a' or child 'span'
                  >

                    {/* This span IS ALWAYS clickable, overriding the parent 'a' tag's pointer-events-none on mobile */}
                    <span className={`bg-gray-900 bg-opacity-70 opacity-70
                                           text-gray-100 text-lg font-semibold
                                           pr-5 pl-3 py-2 rounded-lg
                                           inline-flex items-center shadow-xl border border-white/20
                                           pointer-events-auto /* Make the button itself clickable */
                                          `}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                      </svg>
                      Watch
                    </span>
                  </div>
                </a>
              )}
              {/* End Conditional Link/Banner */}
            </div>


            {/* Film Details  */}
            <div className="p-6 md:p-8 flex-grow">
              {/* Title and Year */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3">
                <h1 className="text-3xl lg:text-4xl font-bold text-slate-100 mb-1 sm:mb-0 pr-4">{film.title}</h1>
                <span className="text-xl font-semibold text-slate-400 flex-shrink-0">({film.year})</span>
              </div>

              {/* Metadata Display (remains the same) */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-400 mb-5">
                {clubAverageDisplay && (
                  <div className="flex items-center font-medium text-base" title={`Average Club Rating (${numberOfValidRatings} ratings)`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400 mr-1.5" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg>
                    <span className="text-slate-200">{clubAverageDisplay}</span><span className="ml-1 text-slate-500">/ {MAX_RATING}</span> <span className="ml-1 text-xs">(Club Avg)</span>
                  </div>
                )}
                {runtimeDisplay && <span className={clubAverageDisplay ? "border-l border-slate-600 pl-4" : ""}>{runtimeDisplay}</span>}
                {film.rated !== 'N/A' && <span className={(clubAverageDisplay || runtimeDisplay) ? "border-l border-slate-600 pl-4" : ""}>{film.rated}</span>}
                {imdbRatingDisplay && (
                  <span className={(clubAverageDisplay || runtimeDisplay || film.rated !== 'N/A') ? "border-l border-slate-600 pl-4 flex items-center text-xs text-slate-500" : "flex items-center text-xs text-slate-500"} title="IMDb Rating">
                    IMDb: {imdbRatingDisplay}/10
                  </span>
                )}
              </div>


              {/* Plot (remains the same) */}
              <div className="mb-5 text-slate-300">
                <p className={isPlotExpanded ? '' : 'line-clamp-3'}>{film.plot || <span className="italic text-slate-500">Plot not available.</span>}</p>
                {film.plot && film.plot.length > 150 && (
                  <button
                    onClick={() => setIsPlotExpanded(!isPlotExpanded)}
                    className="text-blue-400 hover:text-blue-300 text-sm font-medium mt-2"
                  >
                    {isPlotExpanded ? 'Read Less' : 'Read More'}
                  </button>
                )}
              </div>

              {/* Director, Writer, Stars, etc. Grid (remains the same) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm mb-5">
                {film.director && film.director !== 'N/A' && (
                  <div>
                    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Director</h2>
                    <p className="text-slate-300">{film.director}</p>
                  </div>
                )}
                {film.writer && film.writer !== 'N/A' && (
                  <div>
                    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Writer</h2>
                    <p className="text-slate-300">{film.writer}</p>
                  </div>
                )}
                {film.actors && film.actors !== 'N/A' && (
                  <div className="col-span-1 md:col-span-2">
                    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Stars</h2>
                    <p className="text-slate-300">{film.actors}</p>
                  </div>
                )}
                {film.language && film.language !== 'N/A' && (
                  <div>
                    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Language</h2>
                    <p className="text-slate-300">{film.language}</p>
                  </div>
                )}
                {film.country && film.country !== 'N/A' && (
                  <div>
                    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Country</h2>
                    <p className="text-slate-300">{film.country}</p>
                  </div>
                )}
              </div>

              {/* Genres (remains the same) */}
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
            {/* End Film Details */}
          </div>

          {/* Movie Club Info Section (updated to use new schema) */}
          {film.movieClubInfo && (
            <div className="bg-slate-850 border-t-2 border-slate-700 p-6 md:p-8">
              <h2 className="text-2xl font-semibold text-slate-100 mb-6">Film Club Facts</h2>
              <div className="md:flex md:justify-between md:items-start">
                {/* Left side - Watch Date and Ratings */}
                <div className="flex-1 mb-6 md:mb-0 md:pr-6">
                  {film.movieClubInfo.watchDate && (
                    <div className="mb-6">
                      <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider block mb-1">Watch Date</span>
                      <span className="text-slate-200 text-lg">{film.movieClubInfo.watchDate}</span>
                    </div>
                  )}
                  {numberOfValidRatings > 0 ? (
                    <div>
                      <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">Club Rating</h3>
                      {clubAverageDisplay && !isNaN(numericClubRating) && (
                        <div className="mb-5 flex items-center gap-x-4 gap-y-2 flex-wrap">
                          <div className="flex items-baseline whitespace-nowrap">
                            <span className="text-4xl font-bold text-blue-300">{clubAverageDisplay}</span>
                            <span className="text-slate-400 text-lg"> / {MAX_RATING}</span>
                            <span className="ml-2 text-sm text-slate-400">({numberOfValidRatings} ratings)</span>
                          </div>
                          <PopcornRating
                            rating={numericClubRating}
                            maxRating={MAX_RATING}
                            size="regular"
                            title={`Average rating: ${clubAverageDisplay} out of ${MAX_RATING}`}
                          />
                        </div>
                      )}
                      {!clubAverageDisplay && numberOfValidRatings === 1 && (
                        <p className="mb-4 text-slate-400 text-sm italic">Needs at least 2 ratings to show an average.</p>
                      )}
                      <h4 className="text-sm font-semibold text-slate-300 mb-3 mt-4">Individual Ratings:</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                        {film.movieClubInfo.clubRatings
                          .filter(rating => rating.score !== null && typeof rating.score === 'number')
                          .sort((a, b) => a.user.localeCompare(b.user))
                          .map(rating => (
                            <div key={rating.user} className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <Link
                                  to={`/profile/${encodeURIComponent(capitalizeFirstLetter(rating.user))}`}
                                  className="text-slate-300 hover:text-white transition font-medium capitalize w-16 truncate"
                                  title={`View ${capitalizeFirstLetter(rating.user)}'s profile`}
                                >
                                  {capitalizeFirstLetter(rating.user)}:
                                </Link>
                                <span className="font-semibold text-slate-200 w-8 text-right">{rating.score}</span>
                                <PopcornRating
                                  rating={rating.score as number}
                                  maxRating={MAX_RATING}
                                  size="small"
                                  title={`${capitalizeFirstLetter(rating.user)}'s rating: ${rating.score} out of ${MAX_RATING}`}
                                />
                              </div>
                              {rating.blurb && (
                                <div className="bg-gradient-to-r from-slate-800 via-[#2b384e] to-slate-800 px-3 pb-4 pt-4 rounded-lg ml-2 relative border-l-2 border-emerald-400/40 shadow-inner mt-4">
                                  <svg className="absolute text-emerald-400/40 h-5 w-5 -top-1 left-2" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-10zm-14 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                                  </svg>
                                  
                                  {/* Updated blurb display with truncation and line breaks support */}
                                  <div>
                                    {/* Use white-space: pre-line to preserve line breaks and display truncated or full text based on state */}
                                    <p 
                                      className="text-slate-300 text-sm italic" 
                                      style={{ 
                                        whiteSpace: 'pre-line',
                                        overflow: 'hidden',
                                        maxHeight: expandedBlurbs[rating.user] ? 'none' : '100px' 
                                      }}
                                    >
                                      {rating.blurb}
                                    </p>
                                    
                                    {/* Show "Read More/Less" button only if the blurb is long enough */}
                                    {rating.blurb && rating.blurb.length > 150 && (
                                      <button
                                        onClick={() => toggleBlurbExpansion(rating.user)}
                                        className="h-10 !px-3 !py-2 text-blue-400 hover:text-blue-300 !text-xs font-medium mt-4"
                                      >
                                        {expandedBlurbs[rating.user] ? 'Read Less' : 'Read More'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">Club Rating</h3>
                      <p className="text-slate-400 italic">No ratings submitted yet.</p>
                    </div>
                  )}
                </div>
                {/* Right side - Selector with Banner */}
                {selectorName && (
                  <Link
                    to={`/profile/${encodeURIComponent(capitalizeFirstLetter(selectorName))}`}
                    className="flex flex-col items-center md:ml-8 md:flex-shrink-0 mt-6 md:mt-0 group"
                    title={`View ${capitalizeFirstLetter(selectorName)}'s profile`}
                  >
                    <div className="relative mb-2">
                      <CircularImage
                        alt={capitalizeFirstLetter(selectorName)}
                        size="w-32 h-32 md:w-36 md:h-36"
                      />
                      <div
                        className="absolute bottom-0 transform -translate-x-1/2 translate-y-1/4 bg-emerald-600 text-slate-100 px-4 py-1 rounded text-base font-semibold whitespace-nowrap shadow-lg group-hover:scale-105 group-hover:rotate-[5deg] transition-transform duration-200 ease-in-out"
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
              {/* Trophy Info */}
              {(film.movieClubInfo.trophyInfo || film.movieClubInfo.trophyNotes) && (
                <div className="mt-8 pt-6 border-t border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  {/* {film.movieClubInfo.trophyInfo && (
                    <div>
                      <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">Trophy Info</h3>
                      <p className="text-slate-300">{film.movieClubInfo.trophyInfo}</p>
                    </div>
                  )} */}
                  {film.movieClubInfo.trophyNotes && (
                    <div>
                      <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">Trophy gallery</h3>
                      <p className="text-slate-300 whitespace-pre-line">{film.movieClubInfo.trophyNotes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {/* End Movie Club Info Section */}
        </div>

        {/* Other Films by Selector Section (remains the same) */}
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