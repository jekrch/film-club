import React, { useState, useEffect } from 'react';
import FilmList from '../components/films/FilmList'; // Adjust path if needed
import { Film } from '../types/film'; // Adjust path if needed
import filmsData from '../assets/films.json'; // Import the data

// Helper to parse the genre string into an array
const parseGenres = (genreString: string): string[] => {
  if (!genreString || typeof genreString !== 'string') return [];
  return genreString.split(',').map(g => g.trim()).filter(g => g);
};

// Get all unique genres from the loaded films
const getAllGenres = (films: Film[]): string[] => {
  const genreSet = new Set<string>();
  films.forEach(film => {
    // Check if film exists and has a genre property before parsing
    if (film && typeof film.genre === 'string') {
       parseGenres(film.genre).forEach(genre => {
        genreSet.add(genre);
      });
    }
  });
  return Array.from(genreSet).sort();
};

// Define the type for sorting options, matching the available data fields
type SortOption = 'title' | 'year' | 'imdbRating';

const FilmsPage = () => {
  const [films, setFilms] = useState<Film[]>([]);
  const [filteredFilms, setFilteredFilms] = useState<Film[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('title'); // Default sort
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [allGenres, setAllGenres] = useState<string[]>([]);

  useEffect(() => {
    // Load film data from the imported JSON
    // Add basic validation/filtering if needed upon load
    const loadedFilms = (filmsData || []).filter(f => f && typeof f === 'object') as unknown as Film[];
    setFilms(loadedFilms);
    setAllGenres(getAllGenres(loadedFilms));
  }, []);

  useEffect(() => {
    let filtered = [...films];

    // Filter by search term (title or director) - Added safety checks
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(film =>
        (film?.title && typeof film.title === 'string' && film.title.toLowerCase().includes(searchLower)) ||
        (film?.director && typeof film.director === 'string' && film.director.toLowerCase().includes(searchLower))
      );
    }

    // Filter by selected genre - Added safety checks
    if (selectedGenre) {
      filtered = filtered.filter(film =>
         film?.genre && typeof film.genre === 'string' && parseGenres(film.genre).includes(selectedGenre)
      );
    }

    // Sort films - *** ADDED DEFENSIVE CHECKS HERE ***
    filtered.sort((a, b) => {
      // Handle cases where a or b might be null/undefined in the filtered array (less likely but safe)
      if (!a || !b) return 0;

      let comparison = 0;
      if (sortBy === 'title') {
        // Ensure titles are strings before comparing, provide fallback
        const titleA = typeof a.title === 'string' ? a.title : '';
        const titleB = typeof b.title === 'string' ? b.title : '';
        comparison = titleA.localeCompare(titleB);
      } else if (sortBy === 'year') {
        // Ensure years are valid numbers before comparing, provide fallback
        const yearA = parseInt(typeof a.year === 'string' ? a.year : '0') || 0;
        const yearB = parseInt(typeof b.year === 'string' ? b.year : '0') || 0;
        comparison = yearA - yearB;
      } else if (sortBy === 'imdbRating') {
        // Ensure ratings are valid numbers before comparing, handle N/A, provide fallback
        const ratingA = parseFloat(typeof a.imdbRating === 'string' && a.imdbRating !== 'N/A' ? a.imdbRating : '0') || 0;
        const ratingB = parseFloat(typeof b.imdbRating === 'string' && b.imdbRating !== 'N/A' ? b.imdbRating : '0') || 0;
        comparison = ratingA - ratingB;
      }

      // Apply sort direction
      return sortDirection === 'asc' ? comparison : comparison * -1;
    });

    setFilteredFilms(filtered);
  }, [films, searchTerm, selectedGenre, sortBy, sortDirection]);

  const handleSortChange = (option: SortOption) => {
    if (sortBy === option) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(option);
      setSortDirection('asc'); // Default to ascending when changing sort type
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-slate-200 mb-8">Film Collection</h1>

      {/* Filters and Search */}
      <div className="bg-slate-600 rounded-lg shadow-md p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          {/* Search */}
          <div className="col-span-1 md:col-span-2">
            <label htmlFor="search" className="block text-sm font-medium text-gray-400 mb-1">
              Search Films
            </label>
            <input
              type="text"
              id="search"
              placeholder="Search by title or director..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-slate-100"
            />
          </div>

          {/* Genre Filter */}
          <div>
            <label htmlFor="genre" className="block text-sm font-medium text-gray-400 mb-1">
              Filter by Genre
            </label>
            <select
              id="genre"
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-slate-600 text-slate-200"
            >
              <option value="">All Genres</option>
              {allGenres.map((genre) => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Sort By
            </label>
            <div className="flex flex-wrap gap-2">
              {(['title', 'year', 'imdbRating'] as SortOption[]).map((option) => (
                 <button
                    key={option}
                    onClick={() => handleSortChange(option)}
                    className={`px-3 py-2 text-sm rounded-md transition-colors duration-200 ${
                      sortBy === option
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'bg-gray-200 text-slate-400 hover:bg-gray-300'
                    }`}
                  >
                    {/* Capitalize first letter for display */}
                    {option.charAt(0).toUpperCase() + option.slice(1).replace('imdb', 'IMDb ')}
                    {sortBy === option && (
                      <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Results info */}
      <div className="mb-4 text-sm text-slate-200">
        Showing {filteredFilms.length} of {films.length} films.
      </div>

      {/* Film List Component */}
      <FilmList films={filteredFilms} />
    </div>
  );
};

export default FilmsPage;