import {
    parseWatchDate,
    formatRuntime,
    getImdbRatingDisplay,
    parseGenres,
    getFilmBackdrops,
    getFilmBackdrop,
    formatCurrency,
    countValidRatings,
    formatDayGap,
    getAllFilmCreditsForPerson,
} from './filmUtils';
import { makeFilm, makeRating } from '../test-utils/factories';

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
            const film = makeFilm({
                backdropImage: undefined,
                backdropImages: ['still1.jpg', 'still2.jpg'],
            });
            expect(getFilmBackdrop(film)).toBe('still1.jpg');
        });

        it('returns undefined when there is no backdrop imagery', () => {
            const film = makeFilm({ backdropImage: undefined, backdropImages: undefined });
            expect(getFilmBackdrop(film)).toBeUndefined();
        });
    });

    describe('formatCurrency', () => {
        it('renders a USD figure with no cents', () => {
            expect(formatCurrency(1_500_000)).toBe('$1,500,000');
        });

        // TMDb stores an unknown budget or revenue as 0, so a zero must read as
        // "we don't know" and not as a film that grossed nothing.
        it('treats zero and negatives as unknown rather than as an amount', () => {
            expect(formatCurrency(0)).toBeNull();
            expect(formatCurrency(-1)).toBeNull();
        });

        it('returns null for a missing or non-numeric value', () => {
            expect(formatCurrency(null)).toBeNull();
            expect(formatCurrency(undefined)).toBeNull();
            expect(formatCurrency(NaN)).toBeNull();
        });
    });

    describe('countValidRatings', () => {
        // A null score means the member watched it but declined to rate, which
        // must not count toward an average's denominator.
        it('counts only real numeric scores', () => {
            const ratings = [
                makeRating({ score: 8 }),
                makeRating({ score: 0 }),
                makeRating({ score: null }),
            ];
            expect(countValidRatings(ratings)).toBe(2);
        });

        it('is zero for an empty, missing, or non-array value', () => {
            expect(countValidRatings([])).toBe(0);
            expect(countValidRatings(undefined)).toBe(0);
        });
    });

    describe('formatDayGap', () => {
        // The thresholds are the whole point of this function: each band changes
        // the unit, and the boundaries are where it would silently read wrong.
        it('names the unit for each band', () => {
            expect(formatDayGap(0)).toBe('Same day');
            expect(formatDayGap(1)).toBe('1 day');
            expect(formatDayGap(13)).toBe('13 days');
            expect(formatDayGap(14)).toBe('2 weeks');
            expect(formatDayGap(59)).toBe('8 weeks');
            expect(formatDayGap(60)).toBe('2 months');
            expect(formatDayGap(364)).toBe('12 months');
            expect(formatDayGap(365)).toBe('1 year');
        });

        it('singularizes exactly one of each unit', () => {
            expect(formatDayGap(1)).toBe('1 day');
            expect(formatDayGap(7)).toBe('7 days');
            expect(formatDayGap(730)).toBe('2 years');
        });

        it('returns null for a negative, missing, or non-numeric gap', () => {
            expect(formatDayGap(-1)).toBeNull();
            expect(formatDayGap(null)).toBeNull();
            expect(formatDayGap(undefined)).toBeNull();
            expect(formatDayGap(NaN)).toBeNull();
        });
    });

    describe('getAllFilmCreditsForPerson', () => {
        const films = [
            makeFilm({ title: 'A', director: 'Yasujiro Ozu', writer: 'Kogo Noda' }),
            makeFilm({ title: 'B', director: 'Kogo Noda, Yasujiro Ozu' }),
            makeFilm({ title: 'C', actors: 'Setsuko Hara, Chishu Ryu' }),
        ];

        it('finds a person across films and names each role', () => {
            const credits = getAllFilmCreditsForPerson('Yasujiro Ozu', films);
            expect(credits).toHaveLength(2);
            expect(credits.map((c) => c.film.title)).toEqual(['A', 'B']);
            expect(credits[0].roles).toEqual(['Director']);
        });

        // Credit fields are comma-separated lists, so a name must match a whole
        // entry — not merely appear somewhere in the string.
        it('matches a whole comma-separated entry, not a substring', () => {
            const noda = getAllFilmCreditsForPerson('Kogo Noda', films);
            expect(noda.map((c) => c.film.title)).toEqual(['A', 'B']);
            expect(getAllFilmCreditsForPerson('Ozu', films)).toEqual([]);
        });

        it('is case- and whitespace-insensitive', () => {
            expect(getAllFilmCreditsForPerson('  yasujiro ozu  ', films)).toHaveLength(2);
        });

        it('collects every role a person holds on one film', () => {
            const film = makeFilm({
                title: 'Solo',
                director: 'Chaplin',
                writer: 'Chaplin',
                actors: 'Chaplin',
                musicComposer: 'Chaplin',
            });
            const [credit] = getAllFilmCreditsForPerson('Chaplin', [film]);
            expect(credit.roles).toEqual(['Director', 'Writer', 'Actor', 'Music Composer']);
        });

        // Someone billed only in the TMDb cast list is still an actor; the
        // shorter "Stars" string omits most of a cast.
        it('finds a person credited only in the TMDb cast list', () => {
            const film = makeFilm({
                title: 'Cast only',
                actors: 'Someone Else',
                cast: [{ name: 'Chishu Ryu', character: 'Father' }],
            } as Partial<Parameters<typeof makeFilm>[0]>);
            const credits = getAllFilmCreditsForPerson('Chishu Ryu', [film]);
            expect(credits).toHaveLength(1);
            expect(credits[0].roles).toEqual(['Actor']);
        });

        it('does not double-count someone billed in both actors and cast', () => {
            const film = makeFilm({
                actors: 'Chishu Ryu',
                cast: [{ name: 'Chishu Ryu', character: 'Father' }],
            } as Partial<Parameters<typeof makeFilm>[0]>);
            expect(getAllFilmCreditsForPerson('Chishu Ryu', [film])[0].roles).toEqual(['Actor']);
        });

        it('returns nothing for a blank name or an unknown person', () => {
            expect(getAllFilmCreditsForPerson('   ', films)).toEqual([]);
            expect(getAllFilmCreditsForPerson('Nobody', films)).toEqual([]);
        });
    });
});
