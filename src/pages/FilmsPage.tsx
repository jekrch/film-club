import FilmList from '../components/films/FilmList';
import { filmData as initialFilmData } from '../types/film'; 
import { teamMembers } from '../types/team'; 
import PageLayout from '../components/layout/PageLayout';
import BaseCard from '../components/common/BaseCard';
import Select from '../components/common/Select';
import { useFilmFiltering, SortOption, getSortOptionDisplayName } from '../hooks/useFilmFilter';

// Define Member Names for sort options if not already defined in the hook or utils
const clubMemberNamesForSort = teamMembers.filter(t => t.queue).map(u => u.name);

const FilmsPage = () => {
    // Use the custom hook
    const {
        filteredFilms,
        searchTerm,
        setSearchTerm,
        selectedGenre,
        setSelectedGenre,
        allGenres,
        selectedSelector,
        setSelectedSelector,
        allSelectors,
        sortBy,
        sortDirection,
        handleSortChange,
        resultsText,
    } = useFilmFiltering(initialFilmData, 'watchDate', 'desc'); // Pass initial data and defaults

    const allSortOptions: SortOption[] = [
        'title',
        'year',
        'clubRating',
        'controversial',
        'watchDate',
        ...clubMemberNamesForSort
    ];

    return (
        <PageLayout className="pt-4">
            <div className="text-3xl text-slate-300 mb-8">Film Collection</div>

            <BaseCard key={'search-card'} className="bg-slate-700 bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg shadow-lg p-6 mb-8 text-sm">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                        <label htmlFor="search" className="block mb-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">
                            Search Films
                        </label>
                        <div className="group relative">
                            <svg
                                viewBox="0 0 20 20"
                                fill="none"
                                aria-hidden="true"
                                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors duration-200 group-focus-within:text-slate-300"
                            >
                                <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                                <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                            <input
                                type="text"
                                id="search"
                                placeholder="Search title or director..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full rounded-md border border-slate-600/80 bg-slate-800/70 pl-10 pr-9 py-2 text-sm text-slate-100 transition-colors duration-200 placeholder-slate-500 hover:border-slate-500 focus:outline-none focus-visible:border-slate-400 focus-visible:ring-1 focus-visible:ring-slate-400/50"
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    aria-label="Clear search"
                                    className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-sm border-none! bg-transparent! p-0! text-slate-400 transition-colors duration-150 hover:text-slate-100"
                                >
                                    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
                                        <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>

                    <Select
                        id="genre"
                        label="Filter by Genre"
                        placeholder="All Genres"
                        value={selectedGenre}
                        onChange={setSelectedGenre}
                        options={allGenres.map((genre) => ({ value: genre, label: genre }))}
                    />

                    <Select
                        id="selector"
                        label="Filter by Selector"
                        placeholder="All Selectors"
                        value={selectedSelector}
                        onChange={setSelectedSelector}
                        options={allSelectors.map((selector) => ({ value: selector, label: selector }))}
                    />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-baseline gap-3 sm:gap-5 pt-4 border-t border-slate-600/50">
                    <label className="block flex-shrink-0 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400 sm:mb-0">
                        Sort
                    </label>
                    <div className="flex flex-wrap gap-x-1 gap-y-2">
                        {allSortOptions.map((option) => (
                            <button
                                key={option}
                                onClick={() => handleSortChange(option)}
                                className={`group inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border text-[9px] uppercase tracking-[0.12em] transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-slate-400/60 ${sortBy === option
                                    ? 'border-slate-400! bg-slate-900/50! text-slate-100 font-medium'
                                    : 'border-slate-600/60! bg-transparent! text-slate-400 hover:border-slate-400! hover:text-slate-100'
                                    }`}
                            >
                                {getSortOptionDisplayName(option)}
                                <span
                                    className={`text-[10px] leading-none transition-opacity duration-200 ${sortBy === option ? 'opacity-100' : 'opacity-0'}`}
                                    aria-hidden={sortBy !== option}
                                >
                                    {sortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </BaseCard>

            <div className="mb-4 text-sm text-slate-300">
                {resultsText}
            </div>

            <FilmList films={filteredFilms} />
        </PageLayout>
    );
};

export default FilmsPage;