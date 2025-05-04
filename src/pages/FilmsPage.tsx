import { useState, useEffect } from 'react';
import FilmList from '../components/films/FilmList';
import { Film, filmData } from '../types/film'; 
import { calculateClubAverage } from '../utils/ratingUtils';
import { capitalizeUserName, teamMembers } from '../types/team';

// Helper to parse the genre string into an array (remains the same)
const parseGenres = (genreString: string): string[] => {
  if (!genreString || typeof genreString !== 'string') return [];
  return genreString.split(',').map(g => g.trim()).filter(g => g);
};

// Get all unique genres from the loaded films (remains the same)
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

// NEW: Get all unique selectors from the loaded films
const getAllSelectors = (films: Film[]): string[] => {
  const selectorSet = new Set<string>();
  films.forEach(film => {
    // Check if movieClubInfo and selector exist and are non-empty strings
    if (film?.movieClubInfo?.selector && typeof film.movieClubInfo.selector === 'string' && film.movieClubInfo.selector.trim()) {
      selectorSet.add(film.movieClubInfo.selector.trim());
    }
  });
  return Array.from(selectorSet).sort(); // Sort alphabetically
};

// Define Member Names (used for rating sorts)
const clubMemberNames = teamMembers.filter(t => t.queue).map(u => u.name); // Updated to regular string array

// Updated SortOption type
type BaseSortOption = 'title' | 'year' | 'clubRating' | 'watchDate';
type MemberSortOption = string; // Changed from keyof ClubMemberRatings to string
type SortOption = BaseSortOption | MemberSortOption;

// Helper function to get a display name for sort options (remains the same)
const getSortOptionDisplayName = (option: SortOption): string => {
  switch (option) {
    case 'title': return 'Title';
    case 'year': return 'Year';
    case 'clubRating': return 'Club Rating';
    case 'watchDate': return 'Watch Date';
    default:
        return capitalizeUserName(option);
  }
};

// Helper function to check if a film has any club ratings (updated)
const hasAnyClubRating = (film: Film): boolean => {
  const ratings = film.movieClubInfo?.clubRatings;
  if (!ratings || !Array.isArray(ratings) || ratings.length === 0) return false;
  // Check if at least one member rating has a non-null score
  return ratings.some(rating => rating.score !== null);
};

// Helper to get a specific member's rating (similar to getClubRating but scoped to this component)
const getMemberRating = (film: Film, memberName: string): number | null => {
  if (!film.movieClubInfo?.clubRatings) return null;
  const memberRating = film.movieClubInfo.clubRatings.find(
    rating => rating.user.toLowerCase() === memberName.toLowerCase()
  );
  return memberRating?.score || null;
};

const FilmsPage = () => {
  const [films, setFilms] = useState<Film[]>([]);
  const [filteredFilms, setFilteredFilms] = useState<Film[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [selectedSelector, setSelectedSelector] = useState<string>(''); // NEW: State for selector filter
  const [sortBy, setSortBy] = useState<SortOption>('watchDate'); // CHANGED: Default sort by watchDate
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc'); // Default sort direction desc
  const [allGenres, setAllGenres] = useState<string[]>([]);
  const [allSelectors, setAllSelectors] = useState<string[]>([]); // NEW: State for unique selectors list

  useEffect(() => {
    // Ensure filmsData is an array before processing
    const loadedFilmsData = Array.isArray(filmData) ? filmData : [];
    // Basic validation for each film object (can be enhanced)
    const validFilms = loadedFilmsData.filter(f => f && typeof f === 'object' && f.imdbID) as unknown as Film[];

    // Process films (e.g., parse dates if needed, ensure structure)
    // For now, just setting the validated films
    setFilms(validFilms);
    setAllGenres(getAllGenres(validFilms));
    setAllSelectors(getAllSelectors(validFilms)); // NEW: Populate selectors list
  }, []);

  useEffect(() => {
    let workingFiltered = [...films]; // Start with all films

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

    // 3. NEW: Selector Filter
    if (selectedSelector) {
        workingFiltered = workingFiltered.filter(film =>
            film?.movieClubInfo?.selector && film.movieClubInfo.selector === selectedSelector
        );
    }

    // 4. Member Rating Filter (ONLY if sorting by a specific member)
    if (clubMemberNames.includes(sortBy as MemberSortOption)) {
      const memberName = sortBy as MemberSortOption;
      workingFiltered = workingFiltered.filter(film => {
        // Check if this member has rated the film
        return film.movieClubInfo?.clubRatings?.some(
          rating => rating.user.toLowerCase() === memberName.toLowerCase() && rating.score !== null
        );
      });
    }
    // 5. Club Rating Filter (ONLY if sorting by Club Rating)
    else if (sortBy === 'clubRating') {
      workingFiltered = workingFiltered.filter(film =>
        hasAnyClubRating(film) // Film MUST have at least one rating from any member
      );
    }
    // NOTE: 'watchDate' sort does NOT filter based on having a date, it just sorts (null/invalid dates go to start/end depending on direction)

    // --- Sorting Logic ---
    workingFiltered.sort((a, b) => {
      // Basic null checks for safety
      if (!a) return sortDirection === 'asc' ? 1 : -1;
      if (!b) return sortDirection === 'asc' ? -1 : 1;

      let comparison = 0;

      if (clubMemberNames.includes(sortBy as MemberSortOption)) {
        const memberName = sortBy as MemberSortOption;
        // Get the ratings for this member
        const ratingA = getMemberRating(a, memberName) ?? (sortDirection === 'asc' ? Infinity : -Infinity); // Push nulls to end/start
        const ratingB = getMemberRating(b, memberName) ?? (sortDirection === 'asc' ? Infinity : -Infinity);
        comparison = ratingA - ratingB;
      } else {
        switch (sortBy) {
          case 'title':
            const titleA = typeof a.title === 'string' ? a.title : '';
            const titleB = typeof b.title === 'string' ? b.title : '';
            comparison = titleA.localeCompare(titleB);
            break;
          case 'year':
             // Safely parse year, treat invalid/missing as 0 or handle differently if needed
             const yearA = parseInt(String(a.year), 10) || (sortDirection === 'asc' ? Infinity : -Infinity);
             const yearB = parseInt(String(b.year), 10) || (sortDirection === 'asc' ? Infinity : -Infinity);
            comparison = yearA - yearB;
            break;
          case 'clubRating':
            // We filtered, but calculate safely. Assign score based on sort direction for unrated films.
            const avgStrA = calculateClubAverage(a.movieClubInfo?.clubRatings);
            const avgStrB = calculateClubAverage(b.movieClubInfo?.clubRatings);
            const ratingA = parseFloat(avgStrA?.toString() ?? 'NaN') || (sortDirection === 'asc' ? Infinity : -Infinity);
            const ratingB = parseFloat(avgStrB?.toString() ?? 'NaN') || (sortDirection === 'asc' ? Infinity : -Infinity);
            comparison = ratingA - ratingB;
            break;
          case 'watchDate':
            const dateStrA = a.movieClubInfo?.watchDate;
            const dateStrB = b.movieClubInfo?.watchDate;
             // Handle null/invalid dates: push them to the 'end' relative to the sort direction
             // Ascending: Nulls/invalid dates are treated as 'latest' (Infinity)
             // Descending: Nulls/invalid dates are treated as 'earliest' (-Infinity)
            const timeA = dateStrA ? new Date(dateStrA).getTime() : NaN;
            const timeB = dateStrB ? new Date(dateStrB).getTime() : NaN;
             // Assign comparable values based on validity and sort direction
            const valA = isNaN(timeA) ? (sortDirection === 'asc' ? Infinity : -Infinity) : timeA;
            const valB = isNaN(timeB) ? (sortDirection === 'asc' ? Infinity : -Infinity) : timeB;
            comparison = valA - valB;
            break;
          // Default case removed as SortOption should cover all possibilities
        }
      }

      // Apply direction multiplier
      return sortDirection === 'asc' ? comparison : comparison * -1;
    });

    setFilteredFilms(workingFiltered);

  }, [films, searchTerm, selectedGenre, selectedSelector, sortBy, sortDirection]); // ADDED selectedSelector to dependencies

  const handleSortChange = (option: SortOption) => {
    if (sortBy === option) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(option);
      // Typically reset to descending when changing sort column, unless specific UX desired
      setSortDirection('desc');
    }
  };

  // Custom background SVG for the select dropdown arrow (remains the same)
  const customSelectArrow = `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`;

  // Define all sort options for the UI (remains the same)
  const allSortOptions: SortOption[] = [
    'title',
    'year',
    'clubRating',
    'watchDate',
    ...clubMemberNames
  ];

  // --- Determine results text --- (remains the same, accurately reflects count after ALL filters)
  let resultsText = `Showing ${filteredFilms.length} of ${films.length} films.`;
  if (clubMemberNames.includes(sortBy as MemberSortOption)) {
    // This text is only accurate *if* the member filter is the *only* active filter.
    // Keeping it simple: shows count of films rated by member *after* other filters applied.
    resultsText = `Showing ${filteredFilms.length} films rated by ${getSortOptionDisplayName(sortBy)}.`;
  } else if (sortBy === 'clubRating') {
    resultsText = `Showing ${filteredFilms.length} films with Club Ratings.`;
  }
  // Add text specific to selector filter if desired, e.g.:
  // if (selectedSelector) {
  //   resultsText += ` Selected by ${selectedSelector}.`;
  // }


  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-3xl text-slate-100 mb-8">Film Collection</div>

      {/* --- Improved Filters and Sort Container --- */}
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

          {/* NEW: Selector Filter */}
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
                  : 'bg-slate-500 text-slate-100 hover:bg-slate-400 hover:text-slate-50' // Adjusted hover text color
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
      {/* --- End of Filters and Sort Container --- */}

      <div className="mb-4 text-sm text-slate-300">
        {resultsText}
      </div>

      {/* Film List Component */}
      <FilmList films={filteredFilms} />
    </div>
  );
};

export default FilmsPage;