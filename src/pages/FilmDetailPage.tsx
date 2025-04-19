import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Film, ClubMemberRatings } from '../types/film'; // Adjust path if needed
import filmsData from '../assets/films.json';
import FilmCard from '../components/films/FilmCard';
import { calculateClubAverage } from '../utils/ratingUtils'; // Adjust path to where you saved the helper

// Helper to parse the genre string
const parseGenres = (genreString: string): string[] => {
  if (!genreString || typeof genreString !== 'string') return [];
  return genreString.split(',').map(g => g.trim()).filter(g => g);
};

// Format runtime from "XXX min" string to "Xh Ym"
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

// Helper to get IMDb rating display string (still useful for comparison maybe)
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
  const [similarFilms, setSimilarFilms] = useState<Film[]>([]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    if (!imdbId) {
      setError("Film ID is missing in the URL.");
      setLoading(false);
      return;
    }

    const allFilms = filmsData as unknown as Film[]; // Use type assertion carefully
    const foundFilm = allFilms.find(f => f.imdbID === imdbId);

    if (!foundFilm) {
      setError(`Film with ID ${imdbId} not found.`);
      setLoading(false);
      return;
    }

    setFilm(foundFilm);

    // Find similar films (logic remains the same)
    const currentFilmGenres = parseGenres(foundFilm.genre);
    if (currentFilmGenres.length > 0) {
      const similar = allFilms
        .filter(otherFilm =>
          otherFilm.imdbID !== imdbId &&
          parseGenres(otherFilm.genre).some(genre => currentFilmGenres.includes(genre))
        )
        .sort((a, b) => {
           const ratingA = parseFloat(a.imdbRating === 'N/A' ? '0' : a.imdbRating);
           const ratingB = parseFloat(b.imdbRating === 'N/A' ? '0' : b.imdbRating);
           return ratingB - ratingA;
        })
        .slice(0, 5);
      setSimilarFilms(similar);
    } else {
        setSimilarFilms([]);
    }

    setLoading(false);
  }, [imdbId]);

  // --- Loading and Error States (remain the same) ---
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
      </div>
    );
  }

  if (error || !film) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 inline-block" role="alert">
          <p className="font-bold">Error</p>
          <p>{error || "Could not load film details."}</p>
        </div>
        <div>
          <button onClick={() => navigate('/films')} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
            Back to Films List
          </button>
        </div>
      </div>
    );
  }
  // --- --- ---

  const filmGenres = parseGenres(film.genre);
  const runtimeDisplay = formatRuntime(film.runtime);
  // Calculate the club average rating
  const clubAverageDisplay = calculateClubAverage(film.movieClubInfo?.clubRatings);
  // Keep IMDb rating calculation if you want to display it elsewhere or for comparison
  const imdbRatingDisplay = getImdbRatingDisplay(film.imdbRating);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back button (remains the same) */}
      <button onClick={() => navigate(-1)} className="mb-6 inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
        Back
      </button>

      {/* Film Detail Section */}
      <div className="bg-white rounded-lg shadow-xl overflow-hidden mb-12">
        <div className="md:flex">
          {/* Poster (remains the same) */}
          <div className="md:flex-shrink-0 md:w-1/3 lg:w-1/4">
            <img src={film.poster} alt={`${film.title} poster`} className="h-full w-full object-cover"/>
          </div>

          {/* Film Details */}
          <div className="p-6 md:p-8 flex-grow">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
              <h1 className="text-3xl font-bold text-gray-900 mb-2 sm:mb-0">{film.title}</h1>
              <span className="text-xl font-semibold text-gray-600">({film.year})</span>
            </div>

            {/* --- Updated Rating Display --- */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 mb-4">
              {clubAverageDisplay && (
                <div className="flex items-center" title="Average Club Rating">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-500 mr-1" viewBox="0 0 20 20" fill="currentColor">
                     <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                  </svg>
                  <span className="font-medium">{clubAverageDisplay}</span>
                  <span className="ml-1">/ 9</span>
                </div>
              )}
              {runtimeDisplay && <span>{runtimeDisplay}</span>}
              <span>{film.rated}</span>
              {/* Optional: Display IMDb rating separately if desired */}
              {imdbRatingDisplay && (
                 <span className="flex items-center text-xs text-gray-500" title="IMDb Rating">(IMDb: {imdbRatingDisplay}/10)</span>
              )}
            </div>
             {/* --- End of Updated Rating Display --- */}


            {/* Rest of the details (plot, director, etc. remain the same) */}
            <div className="mb-4"><p className="text-gray-700">{film.plot}</p></div>
            <div className="mb-4"><h2 className="text-md font-semibold text-gray-800 mb-1">Director</h2><p className="text-gray-600">{film.director}</p></div>
            <div className="mb-4"><h2 className="text-md font-semibold text-gray-800 mb-1">Writer</h2><p className="text-gray-600">{film.writer}</p></div>
            <div className="mb-4"><h2 className="text-md font-semibold text-gray-800 mb-1">Stars</h2><p className="text-gray-600">{film.actors}</p></div>
            {filmGenres.length > 0 && (
              <div className="mb-4">
                <h2 className="text-md font-semibold text-gray-800 mb-1">Genres</h2>
                <div className="flex flex-wrap gap-2">
                  {filmGenres.map((genre) => (<span key={genre} className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">{genre}</span>))}
                </div>
              </div>
            )}
          </div>
        </div>

         {/* --- Movie Club Info Section (Logic Update) --- */}
        {film.movieClubInfo && (
            <div className="bg-indigo-50 border-t border-indigo-200 p-6 md:p-8">
                <h2 className="text-xl font-semibold text-indigo-900 mb-4">Movie Club Details</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div><p className="text-indigo-700 font-medium">Selected By:</p><p className="text-gray-800">{film.movieClubInfo.selector}</p></div>
                    <div><p className="text-indigo-700 font-medium">Watch Date:</p><p className="text-gray-800">{film.movieClubInfo.watchDate ?? 'Not Watched Yet'}</p></div>

                    {/* Use the calculated average instead of the complex check */}
                    {clubAverageDisplay && (
                       <div className="sm:col-span-2">
                            <p className="text-indigo-700 font-medium mb-1">Club Ratings (out of 9):</p>
                             {/* Display Average */}
                             <p className="text-lg font-bold text-indigo-800 mb-2">{clubAverageDisplay} / 9 (Average)</p>
                             {/* Display Individual Scores */}
                             <ul className="list-disc list-inside space-y-1 text-gray-800 ml-4">
                                {/* Ensure keys are lowercase to match type/JSON */}
                                {Object.entries(film.movieClubInfo.clubRatings).map(([member, rating]) =>
                                    rating !== null && typeof rating === 'number' ? <li key={member}><span className="capitalize">{member}</span>: <span className="font-semibold">{rating}</span></li> : null
                                )}
                            </ul>
                        </div>
                    )}

                    {film.movieClubInfo.trophyInfo && (<div><p className="text-indigo-700 font-medium">Trophy Info:</p><p className="text-gray-800">{film.movieClubInfo.trophyInfo}</p></div>)}
                    {film.movieClubInfo.trophyNotes && (<div><p className="text-indigo-700 font-medium">Trophy Notes:</p><p className="text-gray-800">{film.movieClubInfo.trophyNotes}</p></div>)}
                </div>
            </div>
        )}
         {/* --- End of Movie Club Info Section --- */}

      </div>


      {/* Similar Films Section (remains the same) */}
      {similarFilms.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold mb-6 text-gray-800">Similar Films</h2>
           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
             {similarFilms.map(similarFilm => (<FilmCard key={similarFilm.imdbID} film={similarFilm} />))}
           </div>
        </div>
      )}
    </div>
  );
};

export default FilmDetailPage;