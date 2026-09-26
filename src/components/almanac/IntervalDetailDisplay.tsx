import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../common/Button';
import { Film } from '../../types/film';

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
        <div className="mt-4 p-4 bg-slate-700/25 rounded-xl border border-slate-600/30 animate-fade-in">
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
                <ul className="mt-3 list-none space-y-1">
                    {detail.films.map((film) => (
                        <li key={film.imdbID} className="flex items-baseline gap-2">
                            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                                Watched
                            </span>
                            <Link
                                to={`/films/${film.imdbID}`}
                                className="font-serif italic text-slate-200 transition-colors hover:text-blue-300"
                            >
                                {film.title}
                            </Link>
                            <span className="font-serif text-xs tabular-nums text-slate-500">
                                {film.year}
                            </span>
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
