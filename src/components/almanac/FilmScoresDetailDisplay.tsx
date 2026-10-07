import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../common/Button';
import FilmPosterThumb from './FilmPosterThumb';
import { DatedFilm, formatDay } from '../../utils/timelineUtils';
import { getRatingColorClass } from '../../utils/ratingUtils';

interface FilmScoresDetailDisplayProps {
    /** Small-caps head: what was clicked ("March 2021"). */
    label: string;
    /** The serif figure under it ("7.4"). */
    figure: string;
    /** The small-caps word after the figure ("avg · 3 films"). */
    figureUnit: string;
    /** In the order they were watched; `score` is whatever this panel is about. */
    films: DatedFilm[];
    /**
     * Whether each film's watch date carries its year. Wanted where the films
     * span years; redundant where the label already names the one month.
     */
    datesWithYear?: boolean;
    onClose: () => void;
    closeLabel: string;
}

/**
 * A clicked point's films and their scores, under a timeline chart: a month's
 * films and the club's average for each, or one member's month and what they
 * gave each film.
 */
const FilmScoresDetailDisplay: React.FC<FilmScoresDetailDisplayProps> = ({
    label,
    figure,
    figureUnit,
    films,
    datesWithYear = false,
    onClose,
    closeLabel,
}) => (
    // Inset level, set like the interval detail beside it: a small-caps label,
    // the figure in serif, then the films in watch order.
    <div className="p-4 bg-slate-700/25 rounded-xl border border-slate-600/30">
        <div className="flex items-center gap-2.5">
            <h4 className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
                {label}
            </h4>
            <span className="h-px flex-1 bg-slate-600/40" aria-hidden="true" />
            <Button
                onClick={onClose}
                variant="ghost"
                size="xs"
                className="text-lg leading-none font-bold"
                aria-label={closeLabel}
            >
                &times;
            </Button>
        </div>
        <p className="mt-2 font-serif text-3xl leading-none tracking-tight tabular-nums text-slate-100">
            {figure}
            <span className="ml-1.5 font-sans text-xs font-medium uppercase tracking-widest text-slate-400">
                {figureUnit}
            </span>
        </p>
        <ul className="mt-4 list-none space-y-2.5">
            {films.map(({ film, score, watchDate }) => (
                <li key={film.imdbID} className="flex items-center gap-3">
                    <Link
                        to={`/films/${film.imdbID}`}
                        className="group flex min-w-0 flex-1 items-center gap-3"
                    >
                        <FilmPosterThumb film={film} />
                        <span className="min-w-0">
                            <span className="block truncate font-serif italic text-slate-200 transition-colors group-hover:text-blue-300">
                                {film.title}
                                <span className="ml-1.5 not-italic text-xs tabular-nums text-slate-500">
                                    {film.year}
                                </span>
                            </span>
                            <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.14em] tabular-nums text-slate-500">
                                Watched{' '}
                                {datesWithYear
                                    ? formatDay(watchDate)
                                    : watchDate.toLocaleDateString('en-US', {
                                          month: 'short',
                                          day: 'numeric',
                                          timeZone: 'UTC',
                                      })}
                            </span>
                        </span>
                    </Link>
                    <span
                        className={`flex-shrink-0 font-serif text-lg tabular-nums ${
                            score === null ? 'text-slate-500' : getRatingColorClass(score)
                        }`}
                    >
                        {score === null ? '—' : score.toFixed(1)}
                    </span>
                </li>
            ))}
        </ul>
    </div>
);

export default FilmScoresDetailDisplay;
