import React from 'react';
import { Link } from 'react-router-dom';
import { Film } from '../../types/film';
import { calculateClubAverage } from '../../utils/ratingUtils';

interface FilmCardProps {
  film: Film;
}

const FilmCard: React.FC<FilmCardProps> = ({ film }) => {
  // Calculate the average club rating (logic remains the same)
  const clubAverageDisplay = calculateClubAverage(film.movieClubInfo?.clubRatings);

  return (
    // Link wrapper remains the same, 'group' class is crucial for hover effects
    <Link to={`/films/${film.imdbID}`} className="block group h-full">
      {/* Card container: Dark background, subtle border, transition for hover */}
      <div className="bg-slate-700 rounded-lg overflow-hidden h-full flex flex-col border border-slate-700 group-hover:border-slate-600 transition-all duration-300 ease-in-out shadow-md group-hover:shadow-lg shadow-slate-900/30">
        {/* Image container: Aspect ratio and hover effect */}
        <div className="relative pb-[150%] overflow-hidden"> {/* Maintain aspect ratio */}
          <img
            src={film.poster}
            alt={`${film.title} poster`}
            className="absolute top-0 left-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy" // Keep lazy loading for performance
            onError={(e) => { e.currentTarget.src = '/placeholder-poster.png'; }} // Optional: Add placeholder on error
          />
          {/* Optional: subtle overlay on hover? */}
          {/* <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div> */}
        </div>

        {/* Text content area */}
        <div className="p-4 flex flex-col flex-grow"> {/* Use flex-grow to push bottom content down */}
          {/* Title: Lighter text, blue hover effect */}
          <h3 className="text-base md:text-lg font-semibold text-slate-100 mb-1 truncate group-hover:text-blue-400 transition-colors duration-200">
            {film.title}
          </h3>

          {/* Selector Info: Darker, subtle text */}
          {film.movieClubInfo?.selector && (
            <div className="text-xs text-slate-500 mt-1 mb-2 truncate leading-tight">
              Selected by: <span className="text-gray-300 font-bold">{film.movieClubInfo.selector}</span>
            </div>
          )}

          {/* Year and Rating: Pushed to bottom */}
          <div className="flex justify-between items-center text-sm text-slate-400 mt-auto pt-1">
            <span>{film.year}</span>

            {/* Club Average Rating: Blue icon */}
            {clubAverageDisplay && (
              <span className="flex items-center" title="Average Club Rating">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400 mr-1 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                   <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                </svg>
                {/* Rating text slightly more prominent */}
                <span className="font-medium text-slate-300">{clubAverageDisplay}</span>
                <span className="ml-0.5 text-slate-500">/ 9</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};

export default FilmCard;