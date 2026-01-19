import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilmIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import BaseCard from '../common/BaseCard';
import { UnanimousScoresData } from '../../hooks/useUnanimousScores';

interface UnanimousScoresCardProps {
    unanimousScores: UnanimousScoresData[];
    totalCount: number;
}

const getScoreColorClass = (score: number): string => {
    if (score >= 9) return 'text-emerald-400';
    if (score >= 7) return 'text-green-400';
    if (score >= 5) return 'text-yellow-400';
    if (score >= 3) return 'text-orange-400';
    return 'text-red-400';
};

const getScoreBgClass = (score: number): string => {
    if (score >= 9) return 'bg-emerald-500/10';
    if (score >= 7) return 'bg-green-500/10';
    if (score >= 5) return 'bg-yellow-500/10';
    if (score >= 3) return 'bg-orange-500/10';
    return 'bg-red-500/10';
};

const stripLeadingArticle = (title: string): string => {
    return title.replace(/^(A |The )/i, '');
};

interface UnanimousScoreItemProps {
    data: UnanimousScoresData;
    isExpanded: boolean;
    onToggleExpand: (score: number, e: React.MouseEvent) => void;
    onFilmClick: (imdbID: string) => void;
}

const UnanimousScoreItem: React.FC<UnanimousScoreItemProps> = ({
    data,
    isExpanded,
    onToggleExpand,
    onFilmClick
}) => {
    const { score, films, namesakeFilm } = data;

    return (
        <div className={`p-3 ${getScoreBgClass(score)} rounded-lg transition-colors `}>
            {/* Main namesake row */}
            <div
                className="flex items-center space-x-3 cursor-pointer group"
                onClick={() => onFilmClick(namesakeFilm.imdbID)}
                role="button"
                tabIndex={0}
                onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') onFilmClick(namesakeFilm.imdbID); }}
                title={`View ${namesakeFilm.title}`}
            >
                {/* Film poster */}
                {namesakeFilm.poster && namesakeFilm.poster !== 'N/A' ? (
                    <img
                        src={namesakeFilm.poster}
                        alt={`${namesakeFilm.title} poster`}
                        className="w-10 h-14 object-cover rounded flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow"
                    />
                ) : (
                    <div className="w-10 h-14 bg-slate-700 rounded flex-shrink-0 flex items-center justify-center">
                        <FilmIcon className="h-5 w-5 text-slate-500" />
                    </div>
                )}

                {/* Score badge */}
                <div className={`text-2xl font-bold ${getScoreColorClass(score)} w-8 text-center flex-shrink-0`}>
                    {score}
                </div>

                {/* Title and info */}
                <div className="flex-grow min-w-0">
                    <p className="text-sm font-medium text-slate-200 group-hover:text-slate-100 truncate">
                        A "{stripLeadingArticle(namesakeFilm.title)}"
                    </p>
                    <p className="text-xs text-slate-500">
                        {namesakeFilm.year}{films.length > 1 && ` · ${films.length} films total`}
                    </p>
                </div>

                {/* Expand button (if more than 1 film) */}
                {films.length > 1 && (
                    <button
                        onClick={(e) => onToggleExpand(score, e)}
                        className="p-1 text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0"
                        title={isExpanded ? 'Collapse' : 'Show all films'}
                    >
                        {isExpanded ? (
                            <ChevronUpIcon className="w-4 h-4" />
                        ) : (
                            <ChevronDownIcon className="w-4 h-4" />
                        )}
                    </button>
                )}
            </div>

            {/* Expanded list */}
            {isExpanded && films.length > 1 && (
                <div className="mt-3 pt-3 border-t border-slate-600/30 space-y-2">
                    {films.map(({ film, watchDate }) => (
                        <div
                            key={film.imdbID}
                            className="flex items-center space-x-2 p-2 rounded hover:bg-slate-700/40 cursor-pointer transition-colors ml-1"
                            onClick={() => onFilmClick(film.imdbID)}
                            role="button"
                            tabIndex={0}
                            onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') onFilmClick(film.imdbID); }}
                        >
                            {film.poster && film.poster !== 'N/A' ? (
                                <img
                                    src={film.poster}
                                    alt={`${film.title} poster`}
                                    className="w-7 h-10 object-cover rounded flex-shrink-0"
                                />
                            ) : (
                                <div className="w-7 h-10 bg-slate-700 rounded flex-shrink-0 flex items-center justify-center">
                                    <FilmIcon className="h-3 w-3 text-slate-500" />
                                </div>
                            )}
                            <div className="flex-grow min-w-0">
                                <p className="text-xs text-slate-300 truncate">{film.title}</p>
                            </div>
                            {watchDate && (
                                <span className="text-xs text-slate-500 flex-shrink-0">
                                    {watchDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const UnanimousScoresCard: React.FC<UnanimousScoresCardProps> = ({
    unanimousScores,
}) => {
    const navigate = useNavigate();
    const [expandedScore, setExpandedScore] = useState<number | null>(null);

    const toggleExpanded = (score: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedScore(prev => prev === score ? null : score);
    };

    const handleFilmClick = (imdbID: string) => {
        navigate(`/films/${imdbID}`);
    };

    if (unanimousScores.length === 0) {
        return (
            <BaseCard className="p-6 bg-slate-800">
                <h4 className="text-lg font-semibold text-slate-200 mb-3 pb-2 border-b border-slate-600/50">
                    Unanimous Scores
                </h4>
                <p className="text-sm text-slate-400 italic text-center py-4">
                    No unanimous scores found yet. Keep watching!
                </p>
            </BaseCard>
        );
    }

    return (
        <BaseCard className="p-6 bg-slate-800/80">
            <h4 className="text-lg font-semibold text-slate-200 mb-1 pb-2 border-b border-slate-600/50">
                Unanimous Scores
            </h4>
            {/* <p className="text-xs text-slate-500 mb-2">
                <span className="text-slate-400">{totalCount}</span> films across{' '}
                <span className="text-slate-400">{unanimousScores.length}</span> rating{unanimousScores.length !== 1 ? 's' : ''}
            </p> */}
            <p className="text-xs text-slate-400 mb-4 italic">
                When we all agree, the first film becomes the namesake for that score.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {unanimousScores.map((data) => (
                    <UnanimousScoreItem
                        key={data.score}
                        data={data}
                        isExpanded={expandedScore === data.score}
                        onToggleExpand={toggleExpanded}
                        onFilmClick={handleFilmClick}
                    />
                ))}
            </div>
        </BaseCard>
    );
};

export default UnanimousScoresCard;