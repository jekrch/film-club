import FilmList from '../components/films/FilmList';
import { filmData as initialFilmData } from '../types/film'; 
import { teamMembers } from '../types/team'; 
import PageLayout from '../components/layout/PageLayout';
import BaseCard from '../components/common/BaseCard';
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

    const customSelectArrow = `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`;

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
                        <label htmlFor="search" className="block font-medium text-slate-300 mb-1">
                            Search Films
                        </label>
                        <input
                            type="text"
                            id="search"
                            placeholder="Search title or director..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-500 bg-slate-600 text-slate-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400"
                        />
                    </div>

                    <div>
                        <label htmlFor="genre" className="block font-medium text-slate-300 mb-1">
                            Filter by Genre
                        </label>
                        <div className="relative">
                            <select
                                id="genre"
                                value={selectedGenre}
                                onChange={(e) => setSelectedGenre(e.target.value)}
                                className="w-full pl-4 pr-10 py-2 border border-slate-500 bg-slate-600 text-slate-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
                                style={{ backgroundImage: customSelectArrow, backgroundRepeat: 'no-repeat', backgroundPosition: `right 0.75rem center`, backgroundSize: `1.5em 1.5em` }}
                            >
                                <option value="">All Genres</option>
                                {allGenres.map((genre: any) => (
                                    <option key={genre} value={genre}>{genre}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="selector" className="block font-medium text-slate-300 mb-1">
                            Filter by Selector
                        </label>
                        <div className="relative">
                            <select
                                id="selector"
                                value={selectedSelector}
                                onChange={(e) => setSelectedSelector(e.target.value)}
                                className="w-full pl-4 pr-10 py-2 border border-slate-500 bg-slate-600 text-slate-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
                                style={{ backgroundImage: customSelectArrow, backgroundRepeat: 'no-repeat', backgroundPosition: `right 0.75rem center`, backgroundSize: `1.5em 1.5em` }}
                            >
                                <option value="">All Selectors</option>
                                {allSelectors.map((selector: any) => (
                                    <option key={selector} value={selector}>{selector}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <label className="block font-medium text-slate-300 flex-shrink-0 sm:mb-0">
                        Sort By:
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {allSortOptions.map((option) => (
                            <button
                                key={option}
                                onClick={() => handleSortChange(option)}
                                className={`px-3 py-1.5 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-700 focus:ring-blue-500 text-xs sm:text-sm ${sortBy === option
                                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                                    : 'bg-slate-500 text-slate-100 hover:bg-slate-400 hover:text-slate-50'
                                    }`}
                            >
                                {getSortOptionDisplayName(option)}
                                {sortBy === option && (
                                    <span className="ml-1.5 text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                                )}
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