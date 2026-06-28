import { parseWatchDate, formatRuntime, getImdbRatingDisplay, parseGenres, getFilmBackdrops, getFilmBackdrop } from './filmUtils';
import { makeFilm } from '../test-utils/factories';

describe('filmUtils', () => {
  describe('parseWatchDate', () => {
    it('should parse valid date strings (MM/DD/YYYY)', () => {
      const date = parseWatchDate('10/14/2020');
      expect(date).toEqual(new Date(Date.UTC(2020, 9, 14))); // Month is 0-indexed
    });

    it('should parse valid date strings with short year (MM/DD/YY)', () => {
      const date = parseWatchDate('03/10/22');
      expect(date).toEqual(new Date(Date.UTC(2022, 2, 10)));
    });

    it('should return null for invalid date strings', () => {
      expect(parseWatchDate('invalid-date')).toBeNull();
      expect(parseWatchDate('13/01/2020')).toBeNull(); // Invalid month
      expect(parseWatchDate('10/32/2020')).toBeNull(); // Invalid day
    });

    it('should return null for empty or null input', () => {
      expect(parseWatchDate('')).toBeNull();
      expect(parseWatchDate(null)).toBeNull();
      expect(parseWatchDate(undefined)).toBeNull();
    });
  });

  describe('formatRuntime', () => {
    it('should format runtime string correctly', () => {
      expect(formatRuntime('123 min')).toBe('2h 3m');
    });

    it('should handle runtimes less than an hour', () => {
      expect(formatRuntime('45 min')).toBe('45m');
    });

    it('should handle exact hours', () => {
      expect(formatRuntime('120 min')).toBe('2h 0m');
    });

    it('should return null for invalid runtime strings', () => {
      expect(formatRuntime('N/A')).toBeNull();
      expect(formatRuntime('abc')).toBeNull();
      expect(formatRuntime('')).toBeNull();
      expect(formatRuntime(undefined)).toBeNull();
    });
  });

  describe('getImdbRatingDisplay', () => {
    it('should format IMDb rating string correctly', () => {
      expect(getImdbRatingDisplay('7.8')).toBe('7.8');
    });

    it('should return null for "N/A" or invalid ratings', () => {
      expect(getImdbRatingDisplay('N/A')).toBeNull();
      expect(getImdbRatingDisplay(undefined)).toBeNull();
      expect(getImdbRatingDisplay('abc')).toBeNull();
    });

    it('should handle ratings that need toFixed(1)', () => {
      expect(getImdbRatingDisplay('7')).toBe('7.0');
    });
  });

  describe('parseGenres', () => {
    it('should parse a comma-separated genre string into an array', () => {
      expect(parseGenres('Comedy, Drama, Romance')).toEqual(['Comedy', 'Drama', 'Romance']);
    });

    it('should handle single genres', () => {
      expect(parseGenres('Horror')).toEqual(['Horror']);
    });

    it('should handle empty or undefined strings', () => {
      expect(parseGenres('')).toEqual([]);
      expect(parseGenres(undefined)).toEqual([]);
      expect(parseGenres(null)).toEqual([]);
    });

    it('should trim whitespace from genres', () => {
      expect(parseGenres(' Action , Sci-Fi ')).toEqual(['Action', 'Sci-Fi']);
    });
  });

  describe('getFilmBackdrops', () => {
    it('puts the curated backdropImage first, then the TMDb stills', () => {
      const film = makeFilm({
        backdropImage: 'curated.jpg',
        backdropImages: ['still1.jpg', 'still2.jpg'],
      });
      expect(getFilmBackdrops(film)).toEqual(['curated.jpg', 'still1.jpg', 'still2.jpg']);
    });

    it('falls back to the TMDb stills when there is no curated image', () => {
      const film = makeFilm({ backdropImage: undefined, backdropImages: ['still1.jpg'] });
      expect(getFilmBackdrops(film)).toEqual(['still1.jpg']);
    });

    it('removes duplicate and falsy entries', () => {
      const film = makeFilm({
        backdropImage: 'dup.jpg',
        backdropImages: ['dup.jpg', '', 'unique.jpg'],
      });
      expect(getFilmBackdrops(film)).toEqual(['dup.jpg', 'unique.jpg']);
    });

    it('returns an empty array when the film has no backdrops', () => {
      const film = makeFilm({ backdropImage: undefined, backdropImages: undefined });
      expect(getFilmBackdrops(film)).toEqual([]);
    });
  });

  describe('getFilmBackdrop', () => {
    it('prefers the curated image over TMDb stills', () => {
      const film = makeFilm({ backdropImage: 'curated.jpg', backdropImages: ['still1.jpg'] });
      expect(getFilmBackdrop(film)).toBe('curated.jpg');
    });

    it('uses the top TMDb still when no curated image exists', () => {
      const film = makeFilm({ backdropImage: undefined, backdropImages: ['still1.jpg', 'still2.jpg'] });
      expect(getFilmBackdrop(film)).toBe('still1.jpg');
    });

    it('returns undefined when there is no backdrop imagery', () => {
      const film = makeFilm({ backdropImage: undefined, backdropImages: undefined });
      expect(getFilmBackdrop(film)).toBeUndefined();
    });
  });
});