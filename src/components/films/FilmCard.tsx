import React from 'react';
import { Link } from 'react-router-dom';
import { Film } from '../../types/film'; // Assuming Film type includes director and movieClubInfo.watchedDate
import { calculateClubAverage } from '../../utils/ratingUtils';

interface FilmCardProps {
    film: Film;
}

// Helper function to determine corner positioning classes based on index
const getCornerPositionClasses = (index: number): string => {
    switch (index) {
        case 0: return 'top-2 left-2';   // Top-left
        case 1: return 'top-2 right-2';  // Top-right
        case 2: return 'bottom-2 left-2'; // Bottom-left
        case 3: return 'bottom-2 right-2';// Bottom-right
        default: return 'hidden'; // Hide if more than 4
    }
};

const FilmCard: React.FC<FilmCardProps> = ({ film }) => {
    const clubRatings = film.movieClubInfo?.clubRatings;

    // Prepare the rating entries: Filtered and limited
    const ratingEntries = clubRatings
        ? Object.entries(clubRatings)
            .filter(([, rating]) => rating != null && rating !== '') // Keep only entries with a valid rating
            .slice(0, 4) // Limit to the first 4 valid ratings
        : []; // Empty array if no clubRatings object

    // Calculate average rating
    const clubAverageDisplay = calculateClubAverage(clubRatings);

    // Format watched date
    const watchedDateDisplay = film.movieClubInfo?.watchDate
        ? new Date(film.movieClubInfo.watchDate).toLocaleDateString('en-US', { // Example: DD/MM/YYYY
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        })
        : null;

    return (
        <Link to={`/films/${film.imdbID}`} className="block group h-full">
            <div className="bg-slate-700 rounded-lg overflow-hidden h-full flex flex-col border border-slate-700 group-hover:border-slate-600 transition-all duration-300 ease-in-out shadow-md group-hover:shadow-lg shadow-slate-900/30">
                {/* --- Image Container --- */}
                <div className="relative pb-[150%] overflow-hidden">
                    <img
                        src={film.poster}
                        alt={`${film.title} poster`}
                        className="absolute top-0 left-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                        onError={(e) => { e.currentTarget.src = '/placeholder-poster.png'; }}
                    />

                    {/* --- Individual Reviewer Ratings Overlay --- */}
                    {ratingEntries.map(([name, rating], index) => (
                        <div
                            key={name}
                            title={`${name}: ${rating}/9`}
                            className={`
                                absolute ${getCornerPositionClasses(index)}
                                px-2 py-1 bg-black/65 backdrop-blur-sm rounded
                                flex items-baseline space-x-1.5
                                text-sm shadow-md
                                pointer-events-none
                            `}
                        >
                            <span className="font-semibold text-slate-300 text-xs uppercase leading-none tracking-wide">
                                {name.substring(0, 2)}
                            </span>
                            <span className="font-bold text-white text-base leading-none">
                                {rating}
                            </span>
                        </div>
                    ))}
                    {/* --- End Individual Ratings --- */}
                </div>

                {/* --- Text Content Area --- */}
                <div className="p-4 flex flex-col flex-grow">
                    {/* Title & Director */}
                    <h3 className="text-base md:text-lg font-semibold text-slate-100 mb-1 truncate group-hover:text-blue-400 transition-colors duration-200">
                        {film.title}
                        {film.director && film.director !== "N/A" && (
                             // Display director inline with title (consider moving if too long)
                            <span className="block text-xs text-slate-400 mt-1 font-normal" title={`Director: ${film.director}`}>
                                Dir: <span className="text-slate-300">{film.director}</span>
                            </span>
                             /* Alternative: Keep director on its own line if preferred
                             <div className="text-xs text-slate-400 mt-1 truncate font-normal" title={`Director: ${film.director}`}>
                                Dir: <span className="text-slate-300">{film.director}</span>
                             </div>
                             */
                        )}
                    </h3>


                    {/* Selector Info */}
                    {film.movieClubInfo?.selector && (
                        <div className="text-xs text-slate-500 mt-1 mb-2 truncate leading-tight">
                            Selected by: <span className="text-slate-300 font-bold">{film.movieClubInfo.selector}</span>
                        </div>
                    )}

                    {/* Bottom Row: Year, Watched Date, Rating */}
                    <div className="flex flex-wrap justify-between items-center gap-x-3 gap-y-1 text-sm text-slate-400 mt-auto pt-2">

                        {/* Left side: Year & Watched Date */}
                        <div className="flex items-center space-x-2">
                            <span>{film.year}</span>
                            {/* Watched Date Display Logic */}
                            {watchedDateDisplay && (
                                <>
                                    <span className="text-slate-600">•</span>
                                    <span title={`Watched on: ${watchedDateDisplay}`}>{watchedDateDisplay}</span>
                                </>
                            )}
                        </div>

                        {/* Right side: Club Average Rating */}
                        {clubAverageDisplay && (
                            <span className="flex items-center shrink-0" title="Average Club Rating">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400 mr-1 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                                </svg>
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