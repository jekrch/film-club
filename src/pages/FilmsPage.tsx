import { useState, useEffect } from 'react';
import FilmList from '../components/films/FilmList';
import { Film, ClubMemberRatings } from '../types/film';
import filmsData from '../assets/films.json';
import { calculateClubAverage } from '../utils/ratingUtils';

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

// Define Member Names
const clubMemberNames: (keyof ClubMemberRatings)[] = ['andy', 'gabe', 'jacob', 'joey'];

// UPDATED SortOption type
type BaseSortOption = 'title' | 'year' | 'clubRating' | 'watchDate';
type MemberSortOption = keyof ClubMemberRatings;
type SortOption = BaseSortOption | MemberSortOption;

// Helper function to get a display name for sort options (remains the same)
const getSortOptionDisplayName = (option: SortOption): string => {
  switch (option) {
    case 'title': return 'Title';
    case 'year': return 'Year';
    case 'clubRating': return 'Club Rating';
    case 'watchDate': return 'Watch Date';
    case 'andy': return 'Andy';
    case 'gabe': return 'Gabe';
    case 'jacob': return 'Jacob';
    case 'joey': return 'Joey';
    default:
      return '';
  }
};

// Helper function to check if a film has any club ratings
const hasAnyClubRating = (film: Film): boolean => {
  const ratings = film.movieClubInfo?.clubRatings;
  if (!ratings) return false;
  // Check if at least one member rating is not null
  return Object.values(ratings).some(rating => rating !== null);
};


const FilmsPage = () => {
  const [films, setFilms] = useState<Film[]>([]);
  const [filteredFilms, setFilteredFilms] = useState<Film[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('title');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [allGenres, setAllGenres] = useState<string[]>([]);

  useEffect(() => {
    const loadedFilms = (filmsData || []).filter(f => f && typeof f === 'object') as unknown as Film[];
    setFilms(loadedFilms);
    setAllGenres(getAllGenres(loadedFilms));
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

    // 3. Member Rating Filter (ONLY if sorting by a specific member)
    if (clubMemberNames.includes(sortBy as MemberSortOption)) {
      const memberKey = sortBy as MemberSortOption;
      workingFiltered = workingFiltered.filter(film =>
        film.movieClubInfo?.clubRatings?.[memberKey] != null // Film MUST have a rating from this member
      );
    }
    // 4. Club Rating Filter (ONLY if sorting by Club Rating)
    else if (sortBy === 'clubRating') {
      workingFiltered = workingFiltered.filter(film =>
        hasAnyClubRating(film) // Film MUST have at least one rating from any member
      );
    }
    // NOTE: 'watchDate' sort does NOT filter, it just sorts (null dates go to start/end)

    // --- Sorting Logic ---
    // Sort the `workingFiltered` array
    workingFiltered.sort((a, b) => {
      if (!a) return sortDirection === 'asc' ? 1 : -1;
      if (!b) return sortDirection === 'asc' ? -1 : 1;

      let comparison = 0;

      if (clubMemberNames.includes(sortBy as MemberSortOption)) {
        const memberKey = sortBy as MemberSortOption;
        // We already filtered, so ratings should exist, but default for safety
        const ratingA = a.movieClubInfo?.clubRatings?.[memberKey] ?? 0;
        const ratingB = b.movieClubInfo?.clubRatings?.[memberKey] ?? 0;
        comparison = ratingA - ratingB;
      } else {
        switch (sortBy) {
          case 'title':
            const titleA = typeof a.title === 'string' ? a.title : '';
            const titleB = typeof b.title === 'string' ? b.title : '';
            comparison = titleA.localeCompare(titleB);
            break;
          case 'year':
            const yearA = parseInt(typeof a.year === 'string' ? a.year : '0', 10) || 0;
            const yearB = parseInt(typeof b.year === 'string' ? b.year : '0', 10) || 0;
            comparison = yearA - yearB;
            break;
          case 'clubRating':
            // We already filtered, so films should have ratings, but calculate safely
            const avgStrA = calculateClubAverage(a.movieClubInfo?.clubRatings);
            const avgStrB = calculateClubAverage(b.movieClubInfo?.clubRatings);
            const ratingA = parseFloat(avgStrA ?? '0') || 0;
            const ratingB = parseFloat(avgStrB ?? '0') || 0;
            comparison = ratingA - ratingB;
            break;
          case 'watchDate':
            const dateStrA = a.movieClubInfo?.watchDate;
            const dateStrB = b.movieClubInfo?.watchDate;
            // Handle null/invalid dates during sort
            const timeA = dateStrA ? new Date(dateStrA).getTime() : NaN;
            const timeB = dateStrB ? new Date(dateStrB).getTime() : NaN;
            const valA = isNaN(timeA) ? (sortDirection === 'asc' ? Infinity : -Infinity) : timeA;
            const valB = isNaN(timeB) ? (sortDirection === 'asc' ? Infinity : -Infinity) : timeB;
            comparison = valA - valB;
            break;
          default:
            console.warn("Unhandled sort option:", sortBy);
            break;
        }
      }

      return sortDirection === 'asc' ? comparison : comparison * -1;
    });

    setFilteredFilms(workingFiltered);

  }, [films, searchTerm, selectedGenre, sortBy, sortDirection]);

  const handleSortChange = (option: SortOption) => {
    if (sortBy === option) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(option);
      setSortDirection('desc');
    }
  };

  // Custom background SVG for the select dropdown arrow (remains the same)
  const customSelectArrow = `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`;

  // Define all sort options for the UI
  const allSortOptions: SortOption[] = [
    'title',
    'year',
    'clubRating',
    'watchDate',
    ...clubMemberNames
  ];

  // --- Determine results text ---
  let resultsText = `Showing ${filteredFilms.length} of ${films.length} films.`; // Default
  if (clubMemberNames.includes(sortBy as MemberSortOption)) {
    resultsText = `Showing ${filteredFilms.length} films rated by ${getSortOptionDisplayName(sortBy)}.`;
  } else if (sortBy === 'clubRating') {
    // Now accurate because we added the filter step
    resultsText = `Showing ${filteredFilms.length} films with Club Ratings.`;
  }
  // For title, year, watchDate sort, the default text is appropriate as no rating-specific filtering occurs for them.

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-slate-100 mb-8">Film Collection</h1>

      {/* --- Improved Filters and Sort Container --- */}
      <div className="bg-slate-700 rounded-lg shadow-lg p-6 mb-8 text-sm">

        {/* Row 1: Search and Genre (remains the same) */}
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          {/* Search Input */}
          <div className="flex-1 md:w-1/2 lg:w-2/3">
            <label htmlFor="search" className="block font-medium text-slate-300 mb-1">
              Search Films
            </label>
            <input
              type="text"
              id="search"
              placeholder="Search by title or director..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-slate-500 bg-slate-600 text-slate-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400"
            />
          </div>

          {/* Genre Filter */}
          <div className="flex-1 md:w-1/2 lg:w-1/3">
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
        </div>

        {/* Row 2: Sort By --- Button Styling Reverted --- */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <label className="block font-medium text-slate-300 flex-shrink-0 sm:mb-0">
            Sort By:
          </label>
          <div className="flex flex-wrap gap-2">
            {allSortOptions.map((option) => (
              <button
                key={option}
                onClick={() => handleSortChange(option)}
                className={`px-3 py-1.5 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-700 focus:ring-blue-500 ${sortBy === option
                  ? 'bg-blue-600 text-white font-semibold shadow-sm' // Active state (Original)
                  : 'bg-slate-500 text-slate-100 hover:bg-slate-400 hover:text-slate-500' // Inactive state (Original)
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