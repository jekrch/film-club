import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Film } from '../types/film';
import filmsData from '../assets/films.json';
import { calculateClubAverage } from '../utils/ratingUtils';
import FilmList from '../components/films/FilmList';
import CircularImage from '../components/common/CircularImage';

// --- Popcorn Icon Component ---
const PopcornIcon = ({ filled, size = 'regular', partial = false }: { filled: boolean; size?: 'regular' | 'small'; partial?: boolean }) => {
  // Use CSS filters to make unfilled icons appear darker/greyed out
  const filterClass = filled ? '' : 'brightness-50 opacity-60'; // Darkens and reduces opacity for unfilled

  // Dynamic sizing based on the size prop
  const sizeClass = size === 'small' ? 'w-4 h-4' : 'w-7 h-7';

  // For partial fill effect, use a linear gradient overlay
  const partialStyle = partial ? {
    maskImage: 'linear-gradient(to right, white 50%, transparent 50%)',
    WebkitMaskImage: 'linear-gradient(to right, white 50%, transparent 50%)',
    position: 'relative' as const
  } : {};

  return (
    <div className="relative inline-block">
      <img
        src="/film-club/popcorn.svg"
        alt={filled ? (partial ? "Half-filled popcorn" : "Filled popcorn") : "Empty popcorn"}
        className={`inline-block ${sizeClass} ${filterClass}`}
        style={partial ? partialStyle : {}}
      />
      {partial && (
        <img
          src="/film-club/popcorn.svg"
          alt="Empty portion"
          className={`inline-block ${sizeClass} brightness-50 opacity-60 absolute top-0 left-0`}
          style={{
            clipPath: 'inset(0 0 0 50%)',
            WebkitClipPath: 'inset(0 0 0 50%)'
          }}
        />
      )}
    </div>
  );
};
// --- End of Popcorn Icon Component ---

const parseGenres = (genreString: string): string[] => {
  if (!genreString || typeof genreString !== 'string') return [];
  return genreString.split(',').map(g => g.trim()).filter(g => g);
};

const formatRuntime = (runtimeString: string): string | null => {
  if (!runtimeString || typeof runtimeString !== 'string' || !runtimeString.includes('min')) {
    return null;
  }
  const minutes = parseInt(runtimeString);
  if (isNaN(minutes)) {
    return null;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours > 0 ? hours + 'h ' : ''}${mins}m`;
};

const getImdbRatingDisplay = (rating: string): string | null => {
  if (rating === 'N/A') return null;
  const parsed = parseFloat(rating);
  return isNaN(parsed) ? null : parsed.toFixed(1);
};

const FilmDetailPage = () => {
  const { imdbId } = useParams<{ imdbId: string }>();
  const navigate = useNavigate();
  const [film, setFilm] = useState<Film | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filmsBySameSelector, setFilmsBySameSelector] = useState<Film[]>([]);
  const [isPlotExpanded, setIsPlotExpanded] = useState(false);

  useEffect(() => {
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

    const allFilms = filmsData as unknown as Film[];
    const foundFilm = allFilms.find(f => f.imdbID === imdbId);

    if (!foundFilm) {
      setError(`Film with ID ${imdbId} not found.`);
      setLoading(false);
      return;
    }

    setFilm(foundFilm);

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
  const MAX_RATING = 9; // Define the maximum possible rating
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
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3">
                <h1 className="text-3xl lg:text-4xl font-bold text-slate-100 mb-1 sm:mb-0 pr-4">{film.title}</h1>
                <span className="text-xl font-semibold text-slate-400 flex-shrink-0">({film.year})</span>
              </div>

              {/* Metadata Display */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-400 mb-5">
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
                {film.plot.length > 150 && (
                  <button
                    onClick={() => setIsPlotExpanded(!isPlotExpanded)}
                    className="text-blue-400 hover:text-blue-300 text-sm font-medium mt-2"
                  >
                    {isPlotExpanded ? 'Read Less' : 'Read More'}
                  </button>
                )}
              </div>

              {/* Director, Writer, Stars */}
              <div className="space-y-3 text-sm mb-5">
                <div><h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Director</h2><p className="text-slate-300">{film.director}</p></div>
                <div><h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Writer</h2><p className="text-slate-300">{film.writer}</p></div>
                <div><h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Stars</h2><p className="text-slate-300">{film.actors}</p></div>
              </div>

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
              <h2 className="text-2xl font-semibold text-slate-100 mb-4">Film Club Facts</h2>

              <div className="md:flex md:justify-between md:items-start">
                {/* Left side - Watch Date and Ratings */}
                <div className="flex-1 mb-6 md:mb-0">
                  {/* Compact Watch Date */}
                  <div className="mb-4">
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Watch Date: </span>
                    <span className="text-slate-200">{film.movieClubInfo.watchDate ?? <span className="italic text-slate-400">Not Watched Yet</span>}</span>
                  </div>

                  {/* Combined Ratings Section */}
                  {clubAverageDisplay && !isNaN(numericClubRating) && (
                    <div>
                      {/* Compact Average Display */}
                      <div className="mb-3 flex items-center gap-4">
                        <div className="flex items-baseline">
                          <span className="text-3xl font-bold text-blue-300">{clubAverageDisplay}</span>
                          <span className="text-slate-400">/ {MAX_RATING}</span>
                          <span className="text-slate-500 text-sm ml-2">(Avg)</span>
                        </div>
                        {/* Popcorn Icons inline with average */}
                        <div className="flex items-center space-x-0.5" title={`Average rating: ${clubAverageDisplay} out of ${MAX_RATING}`}>
                          {[...Array(MAX_RATING)].map((_, index) => {
                            const ratingAsNumber = parseFloat(clubAverageDisplay);
                            const hasPartial = ratingAsNumber % 1 >= 0.25 && ratingAsNumber % 1 < 0.75;
                            const partialIndex = hasPartial ? Math.floor(ratingAsNumber) : -1;

                            if (index === partialIndex) {
                              return <PopcornIcon key={index} filled={true} partial={true} size="regular" />;
                            } else if (index < Math.floor(ratingAsNumber)) {
                              return <PopcornIcon key={index} filled={true} size="regular" />;
                            } else {
                              return <PopcornIcon key={index} filled={false} size="regular" />;
                            }
                          })}
                        </div>
                      </div>

                      {/* Compact Individual Ratings */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6">
                        {Object.entries(film.movieClubInfo.clubRatings)
                          .filter(([, rating]) => rating !== null && typeof rating === 'number')
                          .sort(([memberA], [memberB]) => memberA.localeCompare(memberB))
                          .map(([member, rating]) => {
                            const hasPartial = rating % 1 >= 0.25 && rating % 1 < 0.75;
                            const partialIndex = hasPartial ? Math.floor(rating) : -1;

                            return (
                              <div key={member} className="flex items-center">
                                <Link
                                  to={`/profile/${capitalizeFirstLetter(member)}`}
                                  className="text-slate-300 hover:text-white transition font-medium capitalize w-16"
                                >
                                  {member}:
                                </Link>
                                <span className="font-semibold text-slate-200 w-8">{rating}</span>
                                <div className="flex items-center space-x-0.5" title={`${member}'s rating: ${rating} out of ${MAX_RATING}`}>
                                  {[...Array(MAX_RATING)].map((_, index) => {
                                    if (index === partialIndex) {
                                      return <PopcornIcon key={index} filled={true} size="small" partial={true} />;
                                    } else if (index < Math.floor(rating)) {
                                      return <PopcornIcon key={index} filled={true} size="small" />;
                                    } else {
                                      return <PopcornIcon key={index} filled={false} size="small" />;
                                    }
                                  })}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right side - Selector with Banner */}
                {selectorName && (
                  <Link
                    to={`/profile/${encodeURIComponent(selectorName)}`}
                    className="flex flex-col items-center md:ml-8 mb-6"
                  >
                    <div className="relative group">
                      <CircularImage
                        alt={selectorName}
                        size="w-32 h-32 md:w-36 md:h-36"
                      />
                      {/* Tilted Banner */}
                      <div
                        className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1 bg-emerald-600 text-slate-200 px-4 py-1.5 rounded-sm text-lg font-medium whitespace-nowrap shadow-md "
                        style={{
                          transform: 'translateX(2%) translateY(25%) rotate(-5deg)',
                          transformOrigin: 'center'
                        }}
                      >
                        {selectorName}'s Pick
                      </div>
                    </div>
                  </Link>
                )}
              </div>

              {/* Trophy Info - Compact Display */}
              {(film.movieClubInfo.trophyInfo || film.movieClubInfo.trophyNotes) && (
                <div className="mt-6 pt-4 border-t border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {film.movieClubInfo.trophyInfo && (
                    <div>
                      <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Trophy Info: </span>
                      <span className="text-slate-300">{film.movieClubInfo.trophyInfo}</span>
                    </div>
                  )}
                  {film.movieClubInfo.trophyNotes && (
                    <div>
                      <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Trophy Notes: </span>
                      <span className="text-slate-300">{film.movieClubInfo.trophyNotes}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Other Films by Selector Section */}
        {selectorName && (
          <div className="mb-12">
            <FilmList
              films={filmsBySameSelector}
              title={`Other Films Selected by ${selectorName}`}
            />
          </div>
        )}

      </div>
    </div>
  );
};

export default FilmDetailPage;