import React from 'react';
import FilmList from '../films/FilmList';
import { Film } from '../../types/film';
import AccentCard from '../common/AccentCard';

interface FilteredFilmListSectionProps {
    listRef: React.RefObject<HTMLDivElement>;
    title: string;
    films: Film[];
    onClose: () => void;
    layoutMode?: 'horizontal' | 'grid'; 
    hideSizeButtons?: boolean;
    containerClassName?: string;
}

const FilteredFilmListSection: React.FC<FilteredFilmListSectionProps> = ({
    listRef,
    title,
    films,
    onClose,
    layoutMode = 'horizontal',
    hideSizeButtons = true,
    containerClassName = "p-4 mb-8 sm:mb-10 mt-4 animate-fade-in"
}) => {
    return (
        <div ref={listRef}>
        <AccentCard accent="blue" className={containerClassName}>
            <div className="flex justify-between items-center mb-3 border-b border-slate-700/60 pb-2">
                {/* Title is passed to FilmList now */}
                <button
                    onClick={onClose}
                    className="text-xs text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700/80 rounded !px-2 !py-1 transition-colors ml-auto"
                    aria-label="Close film list"
                >
                    &times;
                </button>
            </div>
            {films.length > 0 ? (
                <div>
                    <FilmList
                        films={films}
                        title={`${title} (${films.length})`}
                        hideSizeButtons={hideSizeButtons}
                        layoutMode={layoutMode}
                    />
                </div>
            ) : (
                <p className="text-sm text-slate-400 italic text-center py-4">No films found for this selection.</p>
            )}
        </AccentCard>
        </div>
    );
};

export default FilteredFilmListSection;