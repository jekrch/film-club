import AddClubFilmPanel from '../components/films/AddClubFilmPanel';
import FilmList from '../components/films/FilmList';
import { filmData as initialFilmData } from '../types/film';
import { teamMembers } from '../types/team';
import PageLayout from '../components/layout/PageLayout';
import AccentCard from '../components/common/AccentCard';
import Button from '../components/common/Button';
import Select from '../components/common/Select';
import { useFilmFiltering, SortOption, getSortOptionDisplayName } from '../hooks/useFilmFilter';

// Define Member Names for sort options if not already defined in the hook or utils
const clubMemberNamesForSort = teamMembers.filter((t) => t.queue).map((u) => u.name);

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
        ...clubMemberNamesForSort,
    ];

    return (
        <PageLayout>
            <div className="text-3xl text-slate-300 mb-8">Film Collection</div>

            <AccentCard key={'search-card'} accent="blue" className="p-6 mb-8 text-sm">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                        <label
                            htmlFor="search"
                            className="block mb-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400"
                        >
                            Search Films
                        </label>
                        <div className="group relative">
                            <svg
                                viewBox="0 0 20 20"
                                fill="none"
                                aria-hidden="true"
                                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors duration-200 group-focus-within:text-slate-300"
                            >
                                <circle
                                    cx="9"
                                    cy="9"
                                    r="5.5"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                />
                                <path
                                    d="M13.5 13.5L17 17"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                />
                            </svg>
                            <input
                                type="text"
                                id="search"
                                placeholder="Search title or director..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full rounded-md border border-slate-600/70 bg-slate-800/60 pl-10 pr-9 py-2 text-sm text-slate-100 transition-colors duration-200 placeholder-slate-500 hover:border-slate-500 hover:bg-slate-800/80 focus:outline-none focus-visible:border-slate-400 focus-visible:ring-1 focus-visible:ring-slate-400/50"
                            />
                            {searchTerm && (
                                <Button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    aria-label="Clear search"
                                    variant="ghost"
                                    size="xs"
                                    className="absolute right-2 top-1/2 h-6 w-6 -translate-y-1/2"
                                >
                                    <svg
                                        viewBox="0 0 20 20"
                                        fill="none"
                                        aria-hidden="true"
                                        className="h-3.5 w-3.5"
                                    >
                                        <path
                                            d="M6 6l8 8M14 6l-8 8"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                </Button>
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
                        options={allSelectors.map((selector) => ({
                            value: selector,
                            label: selector,
                        }))}
                    />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-baseline gap-3 sm:gap-5 pt-4 border-t border-slate-700/60">
                    <label className="block flex-shrink-0 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400 sm:mb-0">
                        Sort
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {allSortOptions.map((option) => (
                            <Button
                                key={option}
                                onClick={() => handleSortChange(option)}
                                variant="chip"
                                size="xs"
                                active={sortBy === option}
                                aria-pressed={sortBy === option}
                            >
                                {getSortOptionDisplayName(option)}
                                {/* Fixed-width slot: the glyph is always in flow so
                                    toggling sort never re-flows the row. */}
                                <span
                                    className={`inline-block w-2 text-center text-[10px] leading-none transition-opacity duration-200 ${sortBy === option ? 'opacity-100' : 'opacity-0'}`}
                                    aria-hidden={sortBy !== option}
                                >
                                    {sortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                            </Button>
                        ))}
                    </div>
                </div>
            </AccentCard>

            {/* Adding a film used to mean opening the Google Sheet. Renders
                nothing at all unless a member is signed in. */}
            <AddClubFilmPanel />

            <div className="mb-4 text-sm text-slate-300">{resultsText}</div>

            <FilmList films={filteredFilms} />
        </PageLayout>
    );
};

export default FilmsPage;
