import React from 'react';
import FilmList from '../films/FilmList';
import { Film } from '../../types/film';

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
    containerClassName = "bg-slate-800 rounded-lg p-4 shadow-lg border border-slate-600 mb-8 sm:mb-10 mt-4 animate-fade-in"
}) => {
    return (
        <div ref={listRef} className={containerClassName}>
            <div className="flex justify-between items-center mb-3 border-b border-slate-700 pb-2">
                {/* Title is passed to FilmList now */}
                <button
                    onClick={onClose}
                    className="text-xs text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 rounded !px-2 !py-1 transition-colors ml-auto"
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
        </div>
    );
};

export default FilteredFilmListSection;