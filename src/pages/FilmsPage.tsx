import React, { useState, useEffect } from 'react';
import FilmList from '../components/films/FilmList'; // Adjust path if needed
import { Film } from '../types/film'; // Adjust path if needed
import filmsData from '../assets/films.json'; // Import the data
import { calculateClubAverage } from '../utils/ratingUtils'; // Adjust path if needed

// Helper to parse the genre string into an array
const parseGenres = (genreString: string): string[] => {
  if (!genreString || typeof genreString !== 'string') return [];
  return genreString.split(',').map(g => g.trim()).filter(g => g);
};

// Get all unique genres from the loaded films
const getAllGenres = (films: Film[]): string[] => {
  const genreSet = new Set<string>();
  films.forEach(film => {
    if (film && typeof film.genre === 'string') {
       parseGenres(film.genre).forEach(genre => {
        genreSet.add(genre);
      });
    }
  });
  return Array.from(genreSet).sort();
};

// --- UPDATED SortOption type ---
type SortOption = 'title' | 'year' | 'clubRating'; // Changed 'imdbRating' to 'clubRating'

const FilmsPage = () => {
  const [films, setFilms] = useState<Film[]>([]);
  const [filteredFilms, setFilteredFilms] = useState<Film[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('title');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [allGenres, setAllGenres] = useState<string[]>([]);

  useEffect(() => {
    const loadedFilms = (filmsData || []).filter(f => f && typeof f === 'object') as unknown as Film[];
    setFilms(loadedFilms);
    setAllGenres(getAllGenres(loadedFilms));
  }, []);

  useEffect(() => {
    let filtered = [...films];

    // Filtering logic (remains the same)
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(film =>
        (film?.title && typeof film.title === 'string' && film.title.toLowerCase().includes(searchLower)) ||
        (film?.director && typeof film.director === 'string' && film.director.toLowerCase().includes(searchLower))
      );
    }
    if (selectedGenre) {
      filtered = filtered.filter(film =>
         film?.genre && typeof film.genre === 'string' && parseGenres(film.genre).includes(selectedGenre)
      );
    }

    // --- UPDATED Sorting logic ---
    filtered.sort((a, b) => {
      if (!a || !b) return 0;

      let comparison = 0;
      if (sortBy === 'title') {
        const titleA = typeof a.title === 'string' ? a.title : '';
        const titleB = typeof b.title === 'string' ? b.title : '';
        comparison = titleA.localeCompare(titleB);
      } else if (sortBy === 'year') {
        const yearA = parseInt(typeof a.year === 'string' ? a.year : '0') || 0;
        const yearB = parseInt(typeof b.year === 'string' ? b.year : '0') || 0;
        comparison = yearA - yearB;
      } else if (sortBy === 'clubRating') {
        const avgStrA = calculateClubAverage(a.movieClubInfo?.clubRatings);
        const avgStrB = calculateClubAverage(b.movieClubInfo?.clubRatings);
        const ratingA = parseFloat(avgStrA ?? '0');
        const ratingB = parseFloat(avgStrB ?? '0');
        comparison = ratingA - ratingB;
      }

      return sortDirection === 'asc' ? comparison : comparison * -1;
    });

    setFilteredFilms(filtered);
  }, [films, searchTerm, selectedGenre, sortBy, sortDirection]);

  const handleSortChange = (option: SortOption) => {
    if (sortBy === option) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(option);
      setSortDirection('asc');
    }
  };

  // Custom background SVG for the select dropdown arrow
  const customSelectArrow = `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`;


  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-slate-100 mb-8">Film Collection</h1> {/* Lighter heading */}

      {/* --- Improved Filters and Sort Container --- */}
      <div className="bg-slate-700 rounded-lg shadow-lg p-6 mb-8 text-sm"> {/* Darker, consistent bg */}

        {/* Row 1: Search and Genre */}
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          {/* Search Input */}
          <div className="flex-1 md:w-1/2 lg:w-2/3"> {/* Allow search to take more space */}
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
          <div className="flex-1 md:w-1/2 lg:w-1/3"> {/* Genre takes remaining space */}
            <label htmlFor="genre" className="block font-medium text-slate-300 mb-1">
              Filter by Genre
            </label>
            <div className="relative"> {/* Needed for custom arrow positioning */}
                <select
                  id="genre"
                  value={selectedGenre}
                  onChange={(e) => setSelectedGenre(e.target.value)}
                  className="w-full pl-4 pr-10 py-2 border border-slate-500 bg-slate-600 text-slate-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none" // appearance-none hides default arrow
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

        {/* Row 2: Sort By */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <label className="block font-medium text-slate-300 flex-shrink-0 sm:mb-0"> {/* Align label */}
              Sort By:
            </label>
            <div className="flex flex-wrap gap-2">
              {(['title', 'year', 'clubRating'] as SortOption[]).map((option) => (
                 <button
                    key={option}
                    onClick={() => handleSortChange(option)}
                    // Conditional styling for active/inactive states
                    className={`px-3 py-1.5 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-700 focus:ring-blue-500 ${
                      sortBy === option
                        ? 'bg-blue-600 text-white font-semibold shadow-sm' // Active state
                        : 'bg-slate-500 text-slate-100 hover:bg-slate-400 hover:text-slate-500' // Inactive state
                    }`}
                  >
                    {option === 'clubRating' ? 'Club Rating' : option.charAt(0).toUpperCase() + option.slice(1)}
                    {sortBy === option && (
                      <span className="ml-1.5 text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span> // Slightly smaller arrow
                    )}
                  </button>
              ))}
            </div>
        </div>
      </div>
      {/* --- End of Filters and Sort Container --- */}


      {/* Results info */}
      <div className="mb-4 text-sm text-slate-300"> {/* Lighter text */}
        Showing {filteredFilms.length} of {films.length} films.
      </div>

      {/* Film List Component */}
      <FilmList films={filteredFilms} />
    </div>
  );
};

export default FilmsPage;