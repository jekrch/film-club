import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FilmIcon } from '@heroicons/react/24/outline';
import { ControversialFilm } from '../../utils/statUtils'; // Adjust path as needed
import { getRatingColorClass } from '../../utils/ratingUtils';

/**
 * Props for the ControversialFilmItem component.
 */
interface ControversialFilmItemProps {
    /** The controversial film data. */
    film: ControversialFilm;
}

/**
 * Displays a single film entry in the "Most Controversial Films" list.
 * Shows poster, title, user's score vs others' average, and the divergence value.
 * Navigates to the film details page on click.
 */
const ControversialFilmItem: React.FC<ControversialFilmItemProps> = ({ film }) => {
    const navigate = useNavigate();
    // Handler to navigate to the specific film's page
    const handleNavigate = () => navigate(`/films/${film.filmId}`);

    // Helper to format the divergence score with a leading '+' for positive values.
    const formatDivergence = (divergence: number): string => {
        const fixed = divergence.toFixed(1);
        // Add '+' sign if the number is positive (and not effectively zero)
        return (divergence > 1e-9 ? '+' : '') + fixed;
    };

    const getDivergenceColorClass = (divergence: number): string => {
        return (divergence > 1e-9 ? 'text-emerald-400' : 'text-rose-400');
    };

    const ratingColorClass = getRatingColorClass(film.userScore);
    const othersRatingColorClass = film.othersAvgScore ? getRatingColorClass(film.othersAvgScore!) : '';

    return (
        <div
            className="flex items-center space-x-4 p-3 bg-slate-700/30 hover:bg-slate-700/60 rounded-md transition-colors duration-150 cursor-pointer"
            onClick={handleNavigate}
            title={`View ${film.title}`} // Tooltip for accessibility
            role="button" // Semantics for interaction
            tabIndex={0} // Make it keyboard focusable
            onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') handleNavigate(); }} // Keyboard interaction
        >
            {/* Display film poster or a placeholder */}
            {film.posterUrl && film.posterUrl !== 'N/A' ? (
                <img src={film.posterUrl} alt={`${film.title} poster`} className="w-10 h-14 object-cover rounded flex-shrink-0" />
            ) : (
                <div className="w-10 h-14 bg-slate-700 rounded flex-shrink-0 flex items-center justify-center" aria-hidden="true">
                    <FilmIcon className="h-6 w-6 text-slate-500" />
                </div>
            )}
            {/* Film title and score comparison */}
            <div className="flex-grow min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate" title={film.title}>{film.title}</p>
                <p className="text-xs text-slate-400">
                    <div>{film.memberName}'s score: <span className={`font-semibold ${ratingColorClass}`}>{film.userScore.toFixed(1)}</span></div>
                    {'  '}
                    Others' avg: <span className={`font-semibold ${othersRatingColorClass}`}>{film.othersAvgScore !== null ? film.othersAvgScore.toFixed(1) : 'N/A'}</span>
                </p>
            </div>
            {/* Divergence value */}
            <div className="text-right flex-shrink-0 ml-auto pl-2">
                <p className="text-xs text-slate-400">Divergence</p>
                <p className={`text-lg font-semibold text-slate-100x ${getDivergenceColorClass(film.divergence)}`}>
                    {formatDivergence(film.divergence)}
                </p>
            </div>
        </div>
    );
};

export default ControversialFilmItem;