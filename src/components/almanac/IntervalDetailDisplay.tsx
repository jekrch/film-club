import React from 'react';
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
        <div className="mt-4 p-3 bg-transparent rounded-md border border-slate-600 animate-fade-in">
            <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-semibold text-slate-400">
                    Interval of {detail.days} day{detail.days === 1 ? '' : 's'} ending {detail.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </h4>
                <button
                    onClick={onClose}
                    className="text-lg leading-none font-bold text-slate-400 hover:text-white transition-colors !px-2 !py-1"
                    aria-label="Close interval details"
                >
                    &times;
                </button>
            </div>
            {detail.films.length > 0 ? (
                <ul className="list-none text-xs space-y-1 text-slate-300">
                    {detail.films.map(film => (
                        <li key={film.imdbID}>
                            Film Watched: <span className="italic font-medium text-slate-200">{film.title} ({film.year})</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-xs text-slate-400 italic">No specific film recorded for this interval endpoint.</p>
            )}
        </div>
    );
};

export default IntervalDetailDisplay;