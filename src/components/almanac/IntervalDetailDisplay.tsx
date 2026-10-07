import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../common/Button';
import FilmPosterThumb from './FilmPosterThumb';
import { Film } from '../../types/film';
import { formatDay } from '../../utils/timelineUtils';

// Define a more specific type if FilmWithDate is commonly used
type FilmWithDate = Film & { parsedWatchDate: Date };

interface IntervalDetail {
    startDate: Date;
    endDate: Date;
    days: number;
    films: FilmWithDate[]; // Expecting FilmWithDate based on usage
}

interface IntervalDetailDisplayProps {
    detail: IntervalDetail;
    onClose: () => void;
}

const IntervalDetailDisplay: React.FC<IntervalDetailDisplayProps> = ({ detail, onClose }) => {
    return (
        // Inset level: this sits inside the chart's card. Set like a stat card:
        // a small-caps label, the figure in serif, the film as a serif title.
        // No margin or fade of its own: it opens in a `Collapse`, which carries
        // both.
        <div className="p-4 bg-slate-700/25 rounded-xl border border-slate-600/30">
            <div className="flex items-center gap-2.5">
                <h4 className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
                    Interval ending{' '}
                    {detail.endDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                    })}
                </h4>
                <span className="h-px flex-1 bg-slate-600/40" aria-hidden="true" />
                <Button
                    onClick={onClose}
                    variant="ghost"
                    size="xs"
                    className="text-lg leading-none font-bold"
                    aria-label="Close interval details"
                >
                    &times;
                </Button>
            </div>
            <p className="mt-2 font-serif text-3xl leading-none tracking-tight tabular-nums text-slate-100">
                {detail.days}
                <span className="ml-1.5 font-sans text-xs font-medium uppercase tracking-widest text-slate-400">
                    day{detail.days === 1 ? '' : 's'}
                </span>
            </p>
            {detail.films.length > 0 ? (
                <ul className="mt-4 list-none space-y-2.5">
                    {detail.films.map((film) => (
                        <li key={film.imdbID}>
                            <Link
                                to={`/films/${film.imdbID}`}
                                className="group flex min-w-0 items-center gap-3"
                            >
                                <FilmPosterThumb film={film} />
                                <span className="min-w-0">
                                    <span className="block truncate font-serif italic text-slate-200 transition-colors group-hover:text-blue-300">
                                        {film.title}
                                        <span className="ml-1.5 not-italic text-xs tabular-nums text-slate-500">
                                            {film.year}
                                        </span>
                                    </span>
                                    <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
                                        Watched {formatDay(film.parsedWatchDate)}
                                    </span>
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="mt-3 text-xs text-slate-400 italic">
                    No specific film recorded for this interval endpoint.
                </p>
            )}
        </div>
    );
};

export default IntervalDetailDisplay;
