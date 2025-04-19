import React from 'react';
import { Link } from 'react-router-dom';
import { Film } from '../../types/film'; 
import { calculateClubAverage } from '../../utils/ratingUtils'; 

interface FilmCardProps {
  film: Film;
}

const FilmCard: React.FC<FilmCardProps> = ({ film }) => {
  // Calculate the average club rating
  const clubAverageDisplay = calculateClubAverage(film.movieClubInfo?.clubRatings);

  return (
    <Link to={`/films/${film.imdbID}`} className="block group">
      <div className="bg-white rounded-lg shadow-md overflow-hidden h-full flex flex-col hover:shadow-lg transition-shadow duration-300">
        <div className="relative pb-[150%] overflow-hidden"> {/* Aspect ratio container */}
          <img
            src={film.poster}
            alt={`${film.title} poster`}
            className="absolute top-0 left-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        </div>
        <div className="p-4 flex flex-col flex-grow">
          <h3 className="text-lg font-semibold text-gray-800 mb-1 truncate group-hover:text-blue-600">
            {film.title}
          </h3>
          <div className="flex justify-between items-center text-sm text-gray-600 mt-auto pt-2">
            <span>{film.year}</span>
            {/* Display Club Average Rating if available */}
            {clubAverageDisplay && (
              <span className="flex items-center" title="Average Club Rating">
                {/* Changed icon to represent club/group */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-500 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                </svg>
                <span className="font-medium">{clubAverageDisplay}</span>
                <span className="ml-1">/ 9</span>
              </span>
            )}
          </div>
          {/* Display selector from MovieClubInfo */}
          {film.movieClubInfo?.selector && (
            <div className="text-xs text-gray-500 mt-1 truncate">
              Selected by: {film.movieClubInfo.selector}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};

export default FilmCard;