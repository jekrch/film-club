import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Film } from '../types/film'; // Assuming ClubMemberRatings is part of Film type or not needed directly here
import filmsData from '../assets/films.json';
import FilmCard from '../components/films/FilmCard';
import { calculateClubAverage } from '../utils/ratingUtils';

// Helper functions remain the same
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
  // NEW: State for films selected by the same person
  const [filmsBySameSelector, setFilmsBySameSelector] = useState<Film[]>([]);
  const [isPlotExpanded, setIsPlotExpanded] = useState(false); // State for plot expansion

  useEffect(() => {
    // --- Scroll to top whenever imdbId changes (or component mounts) ---
    window.scrollTo(0, 0);

    // Reset states
    setIsPlotExpanded(false);
    setFilm(null); // Reset film state as well
    setFilmsBySameSelector([]); // Reset related films state
    setLoading(true);
    setError(null);

    if (!imdbId) {
      setError("Film ID is missing in the URL.");
      setLoading(false);
      return;
    }

    // --- Data Fetching and Processing Logic ---
    const allFilms = filmsData as unknown as Film[]; // Make sure Film type includes movieClubInfo
    const foundFilm = allFilms.find(f => f.imdbID === imdbId);

    if (!foundFilm) {
      setError(`Film with ID ${imdbId} not found.`);
      setLoading(false);
      return;
    }

    setFilm(foundFilm);

    // --- NEW: Logic to find other films by the same selector ---
    const currentSelector = foundFilm.movieClubInfo?.selector;
    if (currentSelector) {
      const otherFilms = allFilms
        .filter(otherFilm =>
          otherFilm.imdbID !== imdbId && // Exclude the current film
          otherFilm.movieClubInfo?.selector === currentSelector // Match the selector
        )
        // Optional: Sort these films, e.g., by watch date or title
        .sort((a, b) => {
            // Example sort: newest watched first, then alphabetically
            const dateA = a.movieClubInfo?.watchDate ? new Date(a.movieClubInfo.watchDate).getTime() : 0;
            const dateB = b.movieClubInfo?.watchDate ? new Date(b.movieClubInfo.watchDate).getTime() : 0;
            if (dateB !== dateA) return dateB - dateA; // Sort by date descending
            return a.title.localeCompare(b.title); // Then by title ascending
        });
      setFilmsBySameSelector(otherFilms);
    } else {
      // If the current film has no selector info, the list will be empty
      setFilmsBySameSelector([]);
    }

    setLoading(false);
  }, [imdbId]); // Dependency array includes imdbId

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
  // --- --- ---

  const filmGenres = parseGenres(film.genre);
  const runtimeDisplay = formatRuntime(film.runtime);
  const clubAverageDisplay = calculateClubAverage(film.movieClubInfo?.clubRatings);
  const imdbRatingDisplay = getImdbRatingDisplay(film.imdbRating);
  const selectorName = film.movieClubInfo?.selector; // Get selector name for the title

  return (
    // Overall container with dark background
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

              {/* Rating Display */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-400 mb-5">
                {clubAverageDisplay && (
                  <div className="flex items-center font-medium text-base" title="Average Club Rating">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                    </svg>
                    <span className="text-slate-200">{clubAverageDisplay}</span>
                    <span className="ml-1 text-slate-500">/ 9</span>
                    <span className="ml-2 text-xs text-slate-500">(Club Avg)</span>
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

              {/* Plot with Read More */}
              <div className="mb-5 text-slate-300">
                <p className={isPlotExpanded ? '' : 'line-clamp-3'}>
                  {film.plot}
                </p>
                {film.plot.length > 150 && (
                  <button
                    onClick={() => setIsPlotExpanded(!isPlotExpanded)}
                    className="text-blue-400 hover:text-blue-300 text-sm font-medium mt-1"
                  >
                    {isPlotExpanded ? 'Read Less' : 'Read More'}
                  </button>
                )}
              </div>

              {/* Director, Writer, Stars */}
              <div className="space-y-3 text-sm">
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
                  <h2 className="text-2xl font-semibold text-slate-100 mb-5">Movie Club Facts</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 text-sm">
                      <div>
                         <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">Selected By:</p>
                         {/* Display selector name */}
                         <p className="text-slate-200 text-base">{selectorName ?? <span className="italic text-slate-400">N/A</span>}</p>
                       </div>
                      <div>
                        <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">Watch Date:</p>
                        <p className="text-slate-200 text-base">{film.movieClubInfo.watchDate ?? <span className="italic text-slate-400">Not Watched Yet</span>}</p>
                      </div>

                      {/* Ratings Section */}
                      {clubAverageDisplay && (
                         <div className="md:col-span-2 mt-2 pt-4 border-t border-slate-700">
                              <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">Club Ratings:</p>
                               <div className="mb-4 flex items-baseline gap-x-2">
                                   <span className="text-3xl font-bold text-blue-300">{clubAverageDisplay}</span>
                                   <span className="text-slate-400 text-lg">/ 9</span>
                                   <span className="text-slate-500 text-sm">(Average)</span>
                               </div>
                               <ul className="space-y-1.5 text-slate-300 columns-2 sm:columns-3">
                                  {Object.entries(film.movieClubInfo.clubRatings)
                                     .filter(([, rating]) => rating !== null && typeof rating === 'number')
                                     .sort(([memberA], [memberB]) => memberA.localeCompare(memberB))
                                     .map(([member, rating]) => (
                                          <li key={member} className="flex justify-between items-center text-sm pr-4">
                                              <span className="capitalize text-slate-400">{member}:</span>
                                              <span className="font-semibold text-slate-200">{rating}</span>
                                          </li>
                                  ))}
                              </ul>
                          </div>
                      )}

                    {/* Trophy Info */}
                    {film.movieClubInfo.trophyInfo && (
                       <div className="md:col-span-2 mt-2 pt-4 border-t border-slate-700">
                          <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">Trophy Info:</p>
                          <p className="text-slate-300">{film.movieClubInfo.trophyInfo}</p>
                       </div>
                    )}
                    {film.movieClubInfo.trophyNotes && (
                        <div className={film.movieClubInfo.trophyInfo ? '' : 'md:col-span-2 mt-2 pt-4 border-t border-slate-700'}>
                           <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">Trophy Notes:</p>
                           <p className="text-slate-300">{film.movieClubInfo.trophyNotes}</p>
                        </div>
                    )}
                  </div>
              </div>
          )}
        </div>


        {/* --- NEW: Other Films By Selector Section --- */}
        {filmsBySameSelector.length > 0 && selectorName && (
          <div className="mt-16">
            {/* Updated title */}
            <h2 className="text-2xl font-bold mb-6 text-slate-200">
              Other Films Selected by {selectorName}
            </h2>
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
               {/* Map over the new state variable */}
               {filmsBySameSelector.map(otherFilm => (
                 <FilmCard key={otherFilm.imdbID} film={otherFilm} />
               ))}
             </div>
          </div>
        )}
        {/* --- End of New Section --- */}

      </div>
    </div>
  );
};

export default FilmDetailPage;