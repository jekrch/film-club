import { useState, useEffect } from 'react';
import FilmList from '../components/films/FilmList';
import { Film, filmData } from '../types/film';
import { calculateClubAverage } from '../utils/ratingUtils';
import { capitalizeUserName, teamMembers } from '../types/team';

// Helper to parse the genre string into an array
const parseGenres = (genreString: string): string[] => {
    if (!genreString || typeof genreString !== 'string') return [];
    return genreString.split(',').map(g => g.trim()).filter(g => g);
};

// Get all unique genres from the loaded films
const getAllGenres = (films: Film[]): string[] => {
    const genreSet = new Set<string>();
    films.forEach(film => {
        if (film?.genre && typeof film.genre === 'string') {
            parseGenres(film.genre).forEach(genre => {
                genreSet.add(genre);
            });
        }
    });
    return Array.from(genreSet).sort();
};

// Get all unique selectors from the loaded films
const getAllSelectors = (films: Film[]): string[] => {
    const selectorSet = new Set<string>();
    films.forEach(film => {
        if (film?.movieClubInfo?.selector && typeof film.movieClubInfo.selector === 'string' && film.movieClubInfo.selector.trim()) {
            selectorSet.add(film.movieClubInfo.selector.trim());
        }
    });
    return Array.from(selectorSet).sort();
};

// Define Member Names
const clubMemberNames = teamMembers.filter(t => t.queue).map(u => u.name);

// Updated SortOption type to include 'controversial'
type BaseSortOption = 'title' | 'year' | 'clubRating' | 'watchDate' | 'controversial'; // ADDED 'controversial'
type MemberSortOption = string;
type SortOption = BaseSortOption | MemberSortOption;

// Helper function to get a display name for sort options
const getSortOptionDisplayName = (option: SortOption): string => {
    switch (option) {
        case 'title': return 'Title';
        case 'year': return 'Year';
        case 'clubRating': return 'Club Rating';
        case 'watchDate': return 'Watch Date';
        case 'controversial': return 'Controversial'; // ADDED case for 'controversial'
        default:
            // Assumes any other string is a member name
            return capitalizeUserName(option);
    }
};

// Helper function to check if a film has any club ratings
const hasAnyClubRating = (film: Film): boolean => {
    const ratings = film.movieClubInfo?.clubRatings;
    if (!ratings || !Array.isArray(ratings) || ratings.length === 0) return false;
    return ratings.some(rating => rating.score !== null && typeof rating.score === 'number'); // Ensure score is a number
};

// Helper function to check if a film has at least N valid club ratings
const hasMinClubRatings = (film: Film, minCount: number): boolean => {
    const ratings = film.movieClubInfo?.clubRatings;
    if (!ratings || !Array.isArray(ratings)) return false;
    const validRatings = ratings.filter(rating => rating.score !== null && typeof rating.score === 'number');
    return validRatings.length >= minCount;
};

// Helper to get a specific member's rating
const getMemberRating = (film: Film, memberName: string): number | null => {
    if (!film.movieClubInfo?.clubRatings) return null;
    const memberRating = film.movieClubInfo.clubRatings.find(
        rating => rating.user.toLowerCase() === memberName.toLowerCase()
    );
    // Ensure returned score is a number or null
    const score = memberRating?.score;
    return typeof score === 'number' ? score : null;
};

// NEW: Helper to calculate the score difference for a film
const calculateScoreDifference = (film: Film): number | null => {
    const ratings = film.movieClubInfo?.clubRatings;
    if (!ratings || !Array.isArray(ratings)) return null;

    const validScores = ratings
        .map(r => r.score)
        .filter(score => typeof score === 'number') as number[]; // Filter for valid numbers only

    if (validScores.length < 2) return null; // Need at least two scores to calculate difference

    const maxScore = Math.max(...validScores);
    const minScore = Math.min(...validScores);
    return maxScore - minScore;
};


const FilmsPage = () => {
    const [films, setFilms] = useState<Film[]>([]);
    const [filteredFilms, setFilteredFilms] = useState<Film[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGenre, setSelectedGenre] = useState<string>('');
    const [selectedSelector, setSelectedSelector] = useState<string>('');
    const [sortBy, setSortBy] = useState<SortOption>('watchDate');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [allGenres, setAllGenres] = useState<string[]>([]);
    const [allSelectors, setAllSelectors] = useState<string[]>([]);

    useEffect(() => {
        const loadedFilmsData = Array.isArray(filmData) ? filmData : [];
        const validFilms = loadedFilmsData.filter(f => f && typeof f === 'object' && f.imdbID) as unknown as Film[];
        setFilms(validFilms);
        setAllGenres(getAllGenres(validFilms));
        setAllSelectors(getAllSelectors(validFilms));
    }, []);

    useEffect(() => {
        let workingFiltered = [...films];

        // --- Filtering Logic ---

        // 1. Search Term Filter
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            workingFiltered = workingFiltered.filter(film =>
                (film?.title && typeof film.title === 'string' && film.title.toLowerCase().includes(searchLower)) ||
                (film?.director && typeof film.director === 'string' && film.director.toLowerCase().includes(searchLower))
            );
        }

        // 2. Genre Filter
        if (selectedGenre) {
            workingFiltered = workingFiltered.filter(film =>
                film?.genre && typeof film.genre === 'string' && parseGenres(film.genre).includes(selectedGenre)
            );
        }

        // 3. Selector Filter
        if (selectedSelector) {
            workingFiltered = workingFiltered.filter(film =>
                film?.movieClubInfo?.selector && film.movieClubInfo.selector === selectedSelector
            );
        }

        // --- Filter based on Sort Type BEFORE sorting ---

        // 4. Member Rating Filter (ONLY if sorting by a specific member)
        if (clubMemberNames.includes(sortBy as MemberSortOption)) {
            const memberName = sortBy as MemberSortOption;
            workingFiltered = workingFiltered.filter(film => {
                return film.movieClubInfo?.clubRatings?.some(
                    rating => rating.user.toLowerCase() === memberName.toLowerCase() && typeof rating.score === 'number'
                );
            });
        }
        // 5. Club Rating Filter (ONLY if sorting by Club Rating)
        else if (sortBy === 'clubRating') {
            workingFiltered = workingFiltered.filter(film =>
                hasAnyClubRating(film) // Film MUST have at least one valid rating
            );
        }
        // 6. NEW: Controversial Filter (ONLY if sorting by Controversial)
        else if (sortBy === 'controversial') {
            workingFiltered = workingFiltered.filter(film =>
                hasMinClubRatings(film, 2) // Film MUST have at least two valid ratings
            );
        }

        // --- Sorting Logic ---
        workingFiltered.sort((a, b) => {
            // Basic null checks
            if (!a) return sortDirection === 'asc' ? 1 : -1;
            if (!b) return sortDirection === 'asc' ? -1 : 1;

            let comparison = 0;
            const handleNulls = (val: number | null | undefined): number => {
                // Assign extreme values based on sort direction to push nulls/NaNs to the end
                return (val === null || val === undefined || isNaN(val))
                    ? (sortDirection === 'asc' ? Infinity : -Infinity)
                    : val;
            };

            if (clubMemberNames.includes(sortBy as MemberSortOption)) {
                const memberName = sortBy as MemberSortOption;
                const ratingA = handleNulls(getMemberRating(a, memberName));
                const ratingB = handleNulls(getMemberRating(b, memberName));
                comparison = ratingA - ratingB;
            } else {
                switch (sortBy) {
                    case 'title':
                        const titleA = typeof a.title === 'string' ? a.title : '';
                        const titleB = typeof b.title === 'string' ? b.title : '';
                        comparison = titleA.localeCompare(titleB);
                        break;
                    case 'year':
                        const yearA = handleNulls(parseInt(String(a.year), 10));
                        const yearB = handleNulls(parseInt(String(b.year), 10));
                        comparison = yearA - yearB;
                        break;
                    case 'clubRating':
                        const avgStrA = calculateClubAverage(a.movieClubInfo?.clubRatings);
                        const avgStrB = calculateClubAverage(b.movieClubInfo?.clubRatings);
                        const ratingA = handleNulls(parseFloat(avgStrA?.toString() ?? 'NaN'));
                        const ratingB = handleNulls(parseFloat(avgStrB?.toString() ?? 'NaN'));
                        comparison = ratingA - ratingB;
                        break;
                    case 'watchDate':
                        const dateStrA = a.movieClubInfo?.watchDate;
                        const dateStrB = b.movieClubInfo?.watchDate;
                        const timeA = dateStrA ? new Date(dateStrA).getTime() : NaN;
                        const timeB = dateStrB ? new Date(dateStrB).getTime() : NaN;
                        const valA = handleNulls(timeA);
                        const valB = handleNulls(timeB);
                        comparison = valA - valB;
                        break;
                    case 'controversial': // NEW: Sorting logic for controversial
                        const diffA = handleNulls(calculateScoreDifference(a));
                        const diffB = handleNulls(calculateScoreDifference(b));
                        comparison = diffA - diffB;
                        break;
                }
            }

            // Apply direction multiplier
            return sortDirection === 'asc' ? comparison : comparison * -1;
        });

        setFilteredFilms(workingFiltered);

    }, [films, searchTerm, selectedGenre, selectedSelector, sortBy, sortDirection]);

    const handleSortChange = (option: SortOption) => {
        if (sortBy === option) {
            setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortBy(option);
            // Default to descending for controversial and ratings, ascending for title/year might be better
            setSortDirection(['clubRating', 'controversial', 'watchDate'].includes(option) ? 'desc' : 'asc');
        }
    };

    const customSelectArrow = `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`;

    // Define all sort options for the UI, including 'controversial'
    const allSortOptions: SortOption[] = [
        'title',
        'year',
        'clubRating',
        'controversial', // ADDED controversial option
        'watchDate',
        ...clubMemberNames
    ];

    // --- Determine results text ---
    let resultsText = `Showing ${filteredFilms.length} of ${films.length} films`;
    // Add filter context if needed
    if (searchTerm || selectedGenre || selectedSelector) {
        resultsText = `Showing ${filteredFilms.length} films matching criteria`;
    } else {
        resultsText = `Showing ${filteredFilms.length} of ${films.length} total films`;
    }

    // Add specific sort context
    if (clubMemberNames.includes(sortBy as MemberSortOption)) {
        resultsText += ` (sorted by ${getSortOptionDisplayName(sortBy)}'s rating)`;
    } else if (sortBy === 'clubRating') {
        resultsText = `Showing ${filteredFilms.length} films with Club Ratings (sorted by average)`;
    } else if (sortBy === 'controversial') { // ADDED text for controversial sort
        resultsText = `Showing ${filteredFilms.length} films with at least 2 ratings (sorted by score difference)`;
    } else if (sortBy !== 'watchDate') { // Avoid adding 'sorted by Watch Date' if it's the default initial state maybe
        resultsText += ` (sorted by ${getSortOptionDisplayName(sortBy)})`;
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-3xl text-slate-100 mb-8">Film Collection</div>

            {/* Filters and Sort Container */}
            <div className="bg-slate-700 bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg shadow-lg p-6 mb-8 text-sm">

                {/* Row 1: Search, Genre, and Selector */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    {/* Search Input */}
                    <div className="md:col-span-1">
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

                    {/* Genre Filter */}
                    <div className="md:col-span-1">
                        <label htmlFor="genre" className="block font-medium text-slate-300 mb-1">
                            Filter by Genre
                        </label>
                        <div className="relative">
                            <select
                                id="genre"
                                value={selectedGenre}
                                onChange={(e) => setSelectedGenre(e.target.value)}
                                className="w-full pl-4 pr-10 py-2 border border-slate-500 bg-slate-600 text-slate-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
                                style={{
                                    backgroundImage: customSelectArrow,
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: `right 0.75rem center`,
                                    backgroundSize: `1.5em 1.5em`
                                }}
                            >
                                <option value="">All Genres</option>
                                {allGenres.map((genre) => (
                                    <option key={genre} value={genre}>
                                        {genre}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Selector Filter */}
                    <div className="md:col-span-1">
                        <label htmlFor="selector" className="block font-medium text-slate-300 mb-1">
                            Filter by Selector
                        </label>
                        <div className="relative">
                            <select
                                id="selector"
                                value={selectedSelector}
                                onChange={(e) => setSelectedSelector(e.target.value)}
                                className="w-full pl-4 pr-10 py-2 border border-slate-500 bg-slate-600 text-slate-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
                                style={{
                                    backgroundImage: customSelectArrow,
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: `right 0.75rem center`,
                                    backgroundSize: `1.5em 1.5em`
                                }}
                            >
                                <option value="">All Selectors</option>
                                {allSelectors.map((selector) => (
                                    <option key={selector} value={selector}>
                                        {selector}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Row 2: Sort By Buttons */}
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
            </div>
            {/* End of Filters and Sort Container */}

            <div className="mb-4 text-sm text-slate-300">
                {resultsText}
            </div>

            {/* Film List Component */}
            <FilmList films={filteredFilms} />
        </div>
    );
};

export default FilmsPage;