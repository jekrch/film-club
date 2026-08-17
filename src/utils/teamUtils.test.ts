import { identifyCurrentSelector } from './teamUtils';
import { MovieClubDetails } from '../types/film';
import { TeamMember } from '../types/team';
import { makeClubInfo, makeFilm } from '../test-utils/factories';
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
            { name: 'Charlie', bio: '', image: '', title: '' },
        ];
        const film1 = makeFilm({
            title: 'Film 1',
            imdbID: 'tt1',
            movieClubInfo: makeClubInfo({ selector: 'Alice', watchDate: '2023-01-01' }),
        });
        const film2 = makeFilm({
            title: 'Film 2',
            imdbID: 'tt2',
            movieClubInfo: makeClubInfo({ selector: 'Bob', watchDate: '2023-01-08' }),
        });
        /** Upcoming: a null watch date is what the sheet gives a film not yet seen. */
        const film3Upcoming = makeFilm({
            title: 'Film 3 UPCOMING',
            imdbID: 'tt3',
            movieClubInfo: makeClubInfo({ selector: 'Charlie', watchDate: null }),
        });
        const film4UpcomingInvalidSelector = makeFilm({
            title: 'Film 4 UPCOMING',
            imdbID: 'tt4',
            // Not in activeMembers.
            movieClubInfo: makeClubInfo({ selector: 'David', watchDate: null }),
        });
        /**
         * A watched row with no selector at all. `selector` is required on
         * {@link MovieClubDetails}, so the omission has to be stated as a cast on
         * the whole literal — the sheet can and does emit such a row, and the
         * fallback that handles it is what the test below covers.
         */
        const film5WatchedNoSelector = makeFilm({
            title: 'Film 5 Watched',
            imdbID: 'tt5',
            movieClubInfo: {
                watchDate: '2023-01-15',
                clubRatings: [],
            } as unknown as MovieClubDetails,
        });

        beforeEach(() => {
            // Reset mocks and console spies before each test
            mockParseWatchDate.mockReset();
            jest.spyOn(console, 'log').mockImplementation(() => {});
            jest.spyOn(console, 'warn').mockImplementation(() => {});

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
            const selector = identifyCurrentSelector(film3Upcoming, activeMembers, null, [
                film1,
                film2,
            ]);
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

            const selector = identifyCurrentSelector(
                film4UpcomingInvalidSelector,
                activeMembers,
                null,
                allFilms
            );
            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining(
                    `Selector "David" for upcoming film found in data but not in active team member cycle.`
                )
            );
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
            expect(selector).toBe('Charlie');
        });

        it('should correctly cycle to the first member if the last selector was the last in the active list', () => {
            const filmLastMemberSelected = makeFilm({
                title: 'Last Cycle Film',
                imdbID: 'ttL',
                movieClubInfo: makeClubInfo({ selector: 'Charlie', watchDate: '2023-01-15' }),
            });
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
            // David is not an active member.
            const filmWithInactiveSelector = makeFilm({
                title: 'Film Inactive',
                imdbID: 'ttI',
                movieClubInfo: makeClubInfo({ selector: 'David', watchDate: '2023-01-15' }),
            });
            const allFilms = [film1, filmWithInactiveSelector];
            mockParseWatchDate.mockImplementation((dateStr) => {
                if (dateStr === '2023-01-01') return new Date('2023-01-01T00:00:00.000Z');
                // David's film is most recent
                if (dateStr === '2023-01-15') return new Date('2023-01-15T00:00:00.000Z');
                return null;
            });

            const selector = identifyCurrentSelector(undefined, activeMembers, null, allFilms);
            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining(
                    `Fallback Warning: Selector "David" from most recent film not found in active cycle. Defaulting to the start of the cycle (Alice).`
                )
            );
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
            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining(
                    `Fallback Warning: Most recent watched film has no selector defined. Defaulting to the start of the cycle (Alice).`
                )
            );
            expect(selector).toBe('Alice');
        });

        it('should default to first active member if no films have been watched (fallback)', () => {
            const noWatchedFilms = [film3Upcoming]; // Only an upcoming film, no watchDate
            mockParseWatchDate.mockImplementation((_dateStr) => null); // No valid watch dates

            const selector = identifyCurrentSelector(
                undefined,
                activeMembers,
                null,
                noWatchedFilms
            );
            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining(
                    `Fallback Warning: No films with watch dates found. Defaulting selector to the start of the cycle (Alice).`
                )
            );
            expect(selector).toBe('Alice');
        });

        it('should return null if no active members are in the cycle', () => {
            const selector = identifyCurrentSelector(film3Upcoming, [], null, [film1]);
            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining(
                    'No active members found in the cycle. Cannot determine selector.'
                )
            );
            expect(selector).toBeNull();
        });

        it('should return null if no active members and no upNextFilm (fallback path)', () => {
            const selector = identifyCurrentSelector(undefined, [], null, [film1]);
            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining(
                    'No active members found in the cycle. Cannot determine selector.'
                )
            );
            expect(selector).toBeNull();
        });

        it('should handle empty allFilms array during fallback correctly (defaults to first active member)', () => {
            const selector = identifyCurrentSelector(undefined, activeMembers, null, []);
            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining(
                    `Fallback Warning: No films with watch dates found. Defaulting selector to the start of the cycle (Alice).`
                )
            );
            expect(selector).toBe('Alice');
        });

        it('should handle undefined determinedSelectorName being passed (should be treated as null initially)', () => {
            // This tests the initial state if the third param was undefined instead of null
            const selector = identifyCurrentSelector(
                film3Upcoming,
                activeMembers,
                undefined as unknown as string | null,
                [film1, film2]
            );
            expect(selector).toBe('Charlie');
        });

        it('should correctly parse watch dates and sort films to find the most recent', () => {
            const filmA_older = makeFilm({
                title: 'Film A Older',
                imdbID: 'ttA',
                movieClubInfo: makeClubInfo({ selector: 'Alice', watchDate: '2023-01-01' }),
            });
            const filmB_newer = makeFilm({
                title: 'Film B Newer',
                imdbID: 'ttB',
                movieClubInfo: makeClubInfo({ selector: 'Bob', watchDate: '2023-03-01' }),
            });
            const filmC_middle = makeFilm({
                title: 'Film C Middle',
                imdbID: 'ttC',
                movieClubInfo: makeClubInfo({ selector: 'Charlie', watchDate: '2023-02-01' }),
            });
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
            const filmWithBadDate = makeFilm({
                title: 'Film Bad Date',
                imdbID: 'ttBD',
                movieClubInfo: makeClubInfo({
                    selector: 'Alice',
                    watchDate: 'invalid-date-string',
                }),
            });
            // The most recent of the three, once the bad date is filtered out.
            const filmValidDate = makeFilm({
                title: 'Film Valid Date',
                imdbID: 'ttVD',
                movieClubInfo: makeClubInfo({ selector: 'Bob', watchDate: '2023-01-10' }),
            });
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
