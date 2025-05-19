import { identifyCurrentSelector } from './teamUtils';
import { Film } from '../types/film';
import { TeamMember } from '../types/team';
import { parseWatchDate } from './filmUtils';

// Mock the imported parseWatchDate function
jest.mock('./filmUtils', () => ({
    parseWatchDate: jest.fn(),
}));

describe('teamUtils', () => {
    describe('identifyCurrentSelector', () => {
        const mockParseWatchDate = parseWatchDate as jest.Mock;

        const activeMembers: TeamMember[] = [
            { name: 'Alice', bio: '', image: '', title: '' },
            { name: 'Bob', bio: '', image: '', title: '' },
            { name: 'Charlie', bio: '', image: '', title: ''},
        ];
        // @ts-ignore
        const film1: Film = { title: 'Film 1', imdbID: 'tt1', movieClubInfo: { selector: 'Alice', watchDate: '2023-01-01' } };
        // @ts-ignore
        const film2: Film = { title: 'Film 2', imdbID: 'tt2', movieClubInfo: { selector: 'Bob', watchDate: '2023-01-08' } };
        // @ts-ignore
        const film3Upcoming: Film = { title: 'Film 3 UPCOMING', imdbID: 'tt3', movieClubInfo: { selector: 'Charlie' /* No watchDate */ } };
        // @ts-ignore
        const film4UpcomingInvalidSelector: Film = { title: 'Film 4 UPCOMING', imdbID: 'tt4', movieClubInfo: { selector: 'David' /* Not in activeMembers */ } };
        // @ts-ignore
        const film5WatchedNoSelector: Film = { title: 'Film 5 Watched', imdbID: 'tt5', movieClubInfo: { watchDate: '2023-01-15' /* No selector */ } };

        beforeEach(() => {
            // Reset mocks and console spies before each test
            mockParseWatchDate.mockReset();
            jest.spyOn(console, 'log').mockImplementation(() => { });
            jest.spyOn(console, 'warn').mockImplementation(() => { });

            // Default mock for parseWatchDate
            mockParseWatchDate.mockImplementation((dateString?: string) => {
                if (!dateString) return null;
                return new Date(dateString);
            });
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('should identify selector from upNextFilm if selector is in active members', () => {
            const selector = identifyCurrentSelector(film3Upcoming, activeMembers, null, [film1, film2]);
            expect(selector).toBe('Charlie');
        });

        it('should fallback to next in cycle if upNextFilm selector is not in active members', () => {
            // Most recent watched is film2 (Bob). Next in cycle is Charlie.
            const allFilms = [film1, film2]; // film2 is most recent
            mockParseWatchDate.mockImplementation((dateStr) => {
                if (dateStr === '2023-01-01') return new Date('2023-01-01T00:00:00.000Z');
                if (dateStr === '2023-01-08') return new Date('2023-01-08T00:00:00.000Z');
                return null;
            });

            const selector = identifyCurrentSelector(film4UpcomingInvalidSelector, activeMembers, null, allFilms);
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(`Selector "David" for upcoming film found in data but not in active team member cycle.`));
            expect(selector).toBe('Charlie'); // Bob was last, so Charlie is next
        });

        it('should fallback to next in cycle if upNextFilm is undefined', () => {
            // Most recent watched is film2 (Bob). Next in cycle is Charlie.
            const allFilms = [film1, film2];
            mockParseWatchDate.mockImplementation((dateStr) => {
                if (dateStr === '2023-01-01') return new Date('2023-01-01T00:00:00.000Z');
                if (dateStr === '2023-01-08') return new Date('2023-01-08T00:00:00.000Z');
                return null;
            });
            const selector = identifyCurrentSelector(undefined, activeMembers, null, allFilms);
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Executing fallback logic: No upcoming film found or selector invalid/inactive."));
            expect(selector).toBe('Charlie');
        });

        it('should correctly cycle to the first member if the last selector was the last in the active list', () => {
            // @ts-ignore
            const filmLastMemberSelected: Film = { title: 'Last Cycle Film', imdbID: 'ttL', movieClubInfo: { selector: 'Charlie', watchDate: '2023-01-15' } };
            const allFilms = [film1, film2, filmLastMemberSelected]; // filmLastMemberSelected is most recent
            mockParseWatchDate.mockImplementation((dateStr) => {
                if (dateStr === '2023-01-01') return new Date('2023-01-01T00:00:00.000Z');
                if (dateStr === '2023-01-08') return new Date('2023-01-08T00:00:00.000Z');
                if (dateStr === '2023-01-15') return new Date('2023-01-15T00:00:00.000Z');
                return null;
            });

            const selector = identifyCurrentSelector(undefined, activeMembers, null, allFilms);
            expect(selector).toBe('Alice'); // Charlie was last, so Alice is next (start of cycle)
        });

        it('should default to first active member if last selector from film data is not in active cycle (fallback)', () => {
            // @ts-ignore
            const filmWithInactiveSelector: Film = { title: 'Film Inactive', imdbID: 'ttI', movieClubInfo: { selector: 'David', watchDate: '2023-01-15' } }; // David not active
            const allFilms = [film1, filmWithInactiveSelector];
            mockParseWatchDate.mockImplementation((dateStr) => {
                if (dateStr === '2023-01-01') return new Date('2023-01-01T00:00:00.000Z');
                // David's film is most recent
                if (dateStr === '2023-01-15') return new Date('2023-01-15T00:00:00.000Z');
                return null;
            });

            const selector = identifyCurrentSelector(undefined, activeMembers, null, allFilms);
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(`Fallback Warning: Selector "David" from most recent film not found in active cycle. Defaulting to the start of the cycle (Alice).`));
            expect(selector).toBe('Alice');
        });

        it('should default to first active member if most recent film has no selector defined (fallback)', () => {
            const allFilms = [film1, film5WatchedNoSelector]; // film5 is most recent, no selector
            mockParseWatchDate.mockImplementation((dateStr) => {
                if (dateStr === '2023-01-01') return new Date('2023-01-01T00:00:00.000Z');
                if (dateStr === '2023-01-15') return new Date('2023-01-15T00:00:00.000Z'); // film5WatchedNoSelector date
                return null;
            });

            const selector = identifyCurrentSelector(undefined, activeMembers, null, allFilms);
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(`Fallback Warning: Most recent watched film has no selector defined. Defaulting to the start of the cycle (Alice).`));
            expect(selector).toBe('Alice');
        });

        it('should default to first active member if no films have been watched (fallback)', () => {
            const noWatchedFilms: Film[] = [film3Upcoming]; // Only an upcoming film, no watchDate
            mockParseWatchDate.mockImplementation((_dateStr) => null); // No valid watch dates

            const selector = identifyCurrentSelector(undefined, activeMembers, null, noWatchedFilms);
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(`Fallback Warning: No films with watch dates found. Defaulting selector to the start of the cycle (Alice).`));
            expect(selector).toBe('Alice');
        });

        it('should return null if no active members are in the cycle', () => {
            const selector = identifyCurrentSelector(film3Upcoming, [], null, [film1]);
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("No active members found in the cycle. Cannot determine selector."));
            expect(selector).toBeNull();
        });

        it('should return null if no active members and no upNextFilm (fallback path)', () => {
            const selector = identifyCurrentSelector(undefined, [], null, [film1]);
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("No active members found in the cycle. Cannot determine selector."));
            expect(selector).toBeNull();
        });

        it('should handle empty allFilms array during fallback correctly (defaults to first active member)', () => {
            const selector = identifyCurrentSelector(undefined, activeMembers, null, []);
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(`Fallback Warning: No films with watch dates found. Defaulting selector to the start of the cycle (Alice).`));
            expect(selector).toBe('Alice');
        });

        it('should handle undefined determinedSelectorName being passed (should be treated as null initially)', () => {
            // This tests the initial state if the third param was undefined instead of null
            const selector = identifyCurrentSelector(film3Upcoming, activeMembers, undefined as any, [film1, film2]);
            expect(selector).toBe('Charlie');
        });

        it('should correctly parse watch dates and sort films to find the most recent', () => {
            // @ts-ignore
            const filmA_older: Film = { title: 'Film A Older', imdbID: 'ttA', movieClubInfo: { selector: 'Alice', watchDate: '2023-01-01' } };
            // @ts-ignore
            const filmB_newer: Film = { title: 'Film B Newer', imdbID: 'ttB', movieClubInfo: { selector: 'Bob', watchDate: '2023-03-01' } }; // Newer
            // @ts-ignore
            const filmC_middle: Film = { title: 'Film C Middle', imdbID: 'ttC', movieClubInfo: { selector: 'Charlie', watchDate: '2023-02-01' } };
            const allFilms = [filmA_older, filmB_newer, filmC_middle];

            mockParseWatchDate.mockImplementation((dateStr?: string) => {
                if (dateStr === '2023-01-01') return new Date('2023-01-01T00:00:00.000Z');
                if (dateStr === '2023-02-01') return new Date('2023-02-01T00:00:00.000Z');
                if (dateStr === '2023-03-01') return new Date('2023-03-01T00:00:00.000Z');
                return null;
            });
            // No upNextFilm, fallback to most recent. Bob selected filmB_newer. Next should be Charlie.
            const selector = identifyCurrentSelector(undefined, activeMembers, null, allFilms);
            // Active members: Alice, Bob, Charlie
            // Last selector was Bob (from filmB_newer), next is Charlie
            expect(selector).toBe('Charlie');
        });

        it('should handle if parseWatchDate returns null for some dates (they should be filtered out)', () => {
            // @ts-ignore
            const filmWithBadDate: Film = { title: 'Film Bad Date', imdbID: 'ttBD', movieClubInfo: { selector: 'Alice', watchDate: 'invalid-date-string' } };
            // @ts-ignore
            const filmValidDate: Film = { title: 'Film Valid Date', imdbID: 'ttVD', movieClubInfo: { selector: 'Bob', watchDate: '2023-01-10' } }; // This should be most recent
            const allFilms = [filmWithBadDate, filmValidDate, film1]; // film1: Alice, 2023-01-01

            mockParseWatchDate.mockImplementation((dateStr?: string) => {
                if (dateStr === '2023-01-01') return new Date('2023-01-01T00:00:00.000Z');
                if (dateStr === '2023-01-10') return new Date('2023-01-10T00:00:00.000Z');
                if (dateStr === 'invalid-date-string') return null;
                return null;
            });
            // No upNextFilm. Most recent valid is filmValidDate (Bob). Next should be Charlie.
            const selector = identifyCurrentSelector(undefined, activeMembers, null, allFilms);
            expect(selector).toBe('Charlie');
        });
    });
});