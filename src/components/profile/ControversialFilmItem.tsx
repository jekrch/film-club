import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FilmIcon } from '@heroicons/react/24/outline';
import { ControversialFilm } from '../../utils/statUtils';
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
 * Shows poster, title, the divergence, and the member's score against the club
 * average.
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
        return divergence > 1e-9 ? 'text-emerald-400' : 'text-rose-400';
    };

    const ratingColorClass = getRatingColorClass(film.userScore);
    const othersRatingColorClass = film.othersAvgScore
        ? getRatingColorClass(film.othersAvgScore!)
        : '';

    const memberLabel = film.memberName ?? 'Theirs';

    return (
        <div
            className="flex items-center gap-3.5 rounded-xl border border-slate-600/30 bg-slate-700/25 p-3 transition-colors duration-200 hover:border-rose-400/30 hover:bg-slate-700/45 cursor-pointer"
            onClick={handleNavigate}
            title={`View ${film.title}`} // Tooltip for accessibility
            role="button" // Semantics for interaction
            tabIndex={0} // Make it keyboard focusable
            onKeyPress={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleNavigate();
            }} // Keyboard interaction
        >
            {/* Display film poster or a placeholder */}
            {film.posterUrl && film.posterUrl !== 'N/A' ? (
                <img
                    src={film.posterUrl}
                    alt={`${film.title} poster`}
                    className="w-10 h-14 object-cover rounded flex-shrink-0 shadow-sm shadow-black/40 ring-1 ring-slate-600/40"
                />
            ) : (
                <div
                    className="w-10 h-14 bg-slate-700/50 rounded flex-shrink-0 flex items-center justify-center"
                    aria-hidden="true"
                >
                    <FilmIcon className="h-6 w-6 text-slate-500" />
                </div>
            )}

            <div className="flex-grow min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-slate-200 truncate" title={film.title}>
                        {film.title}
                    </p>
                    <span
                        className={`flex-shrink-0 font-serif text-lg leading-none tabular-nums ${getDivergenceColorClass(film.divergence)}`}
                        title="Divergence from the club average"
                    >
                        {formatDivergence(film.divergence)}
                    </span>
                </div>

                <div className="mt-1.5 flex items-baseline gap-4 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                    <span className="truncate">
                        {memberLabel}{' '}
                        <span
                            className={`ml-0.5 font-serif text-xs normal-case tracking-normal tabular-nums ${ratingColorClass}`}
                        >
                            {film.userScore.toFixed(1)}
                        </span>
                    </span>
                    <span className="whitespace-nowrap">
                        Club{' '}
                        <span
                            className={`ml-0.5 font-serif text-xs normal-case tracking-normal tabular-nums ${othersRatingColorClass}`}
                        >
                            {film.othersAvgScore !== null ? film.othersAvgScore.toFixed(1) : 'N/A'}
                        </span>
                    </span>
                </div>
            </div>
        </div>
    );
};

export default ControversialFilmItem;
