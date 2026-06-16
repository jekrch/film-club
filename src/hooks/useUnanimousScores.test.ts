import { renderHook } from '@testing-library/react';
import { useUnanimousScores } from './useUnanimousScores';
import { makeFilm, makeClubInfo, makeRating, makeMember } from '../test-utils/factories';

const members = [
    makeMember({ name: 'Andy', queue: 1 }),
    makeMember({ name: 'Gabe', queue: 2 }),
    makeMember({ name: 'Mark' }), // inactive: no queue
];

describe('useUnanimousScores', () => {
    it('returns empty results when there are no films or members', () => {
        const noFilms = renderHook(() => useUnanimousScores([], members));
        expect(noFilms.result.current.unanimousScores).toEqual([]);
        expect(noFilms.result.current.totalUnanimousCount).toBe(0);

        const noMembers = renderHook(() => useUnanimousScores([makeFilm()], []));
        expect(noMembers.result.current.unanimousScores).toEqual([]);
    });

    it('returns empty when fewer than two active members exist', () => {
        const film = makeFilm({
            movieClubInfo: makeClubInfo({
                clubRatings: [makeRating({ user: 'andy', score: 9 })],
            }),
        });
        const { result } = renderHook(() =>
            useUnanimousScores([film], [makeMember({ name: 'Andy', queue: 1 })])
        );
        expect(result.current.unanimousScores).toEqual([]);
    });

    it('identifies a film where all active members gave the same score', () => {
        const film = makeFilm({
            title: 'Unanimous Hit',
            movieClubInfo: makeClubInfo({
                clubRatings: [
                    makeRating({ user: 'andy', score: 9 }),
                    makeRating({ user: 'gabe', score: 9 }),
                ],
            }),
        });
        const { result } = renderHook(() => useUnanimousScores([film], members));

        expect(result.current.unanimousScores).toHaveLength(1);
        expect(result.current.unanimousScores[0].score).toBe(9);
        expect(result.current.totalUnanimousCount).toBe(1);
    });

    it('ignores inactive members when checking for unanimity', () => {
        const film = makeFilm({
            movieClubInfo: makeClubInfo({
                clubRatings: [
                    makeRating({ user: 'andy', score: 7 }),
                    makeRating({ user: 'gabe', score: 7 }),
                    makeRating({ user: 'mark', score: 2 }), // inactive, should not break unanimity
                ],
            }),
        });
        const { result } = renderHook(() => useUnanimousScores([film], members));
        expect(result.current.unanimousScores).toHaveLength(1);
        expect(result.current.unanimousScores[0].score).toBe(7);
    });

    it('does not count a film when an active member is missing a score', () => {
        const film = makeFilm({
            movieClubInfo: makeClubInfo({
                clubRatings: [makeRating({ user: 'andy', score: 7 })], // gabe missing
            }),
        });
        const { result } = renderHook(() => useUnanimousScores([film], members));
        expect(result.current.unanimousScores).toEqual([]);
    });

    it('does not count a film where scores differ', () => {
        const film = makeFilm({
            movieClubInfo: makeClubInfo({
                clubRatings: [
                    makeRating({ user: 'andy', score: 8 }),
                    makeRating({ user: 'gabe', score: 6 }),
                ],
            }),
        });
        const { result } = renderHook(() => useUnanimousScores([film], members));
        expect(result.current.unanimousScores).toEqual([]);
    });

    it('groups films by score and picks the earliest-watched as the namesake', () => {
        const older = makeFilm({
            title: 'Older Nine',
            movieClubInfo: makeClubInfo({
                watchDate: '01/01/2020',
                clubRatings: [
                    makeRating({ user: 'andy', score: 9 }),
                    makeRating({ user: 'gabe', score: 9 }),
                ],
            }),
        });
        const newer = makeFilm({
            title: 'Newer Nine',
            movieClubInfo: makeClubInfo({
                watchDate: '06/01/2021',
                clubRatings: [
                    makeRating({ user: 'andy', score: 9 }),
                    makeRating({ user: 'gabe', score: 9 }),
                ],
            }),
        });
        const lower = makeFilm({
            title: 'A Seven',
            movieClubInfo: makeClubInfo({
                watchDate: '01/01/2019',
                clubRatings: [
                    makeRating({ user: 'andy', score: 7 }),
                    makeRating({ user: 'gabe', score: 7 }),
                ],
            }),
        });

        const { result } = renderHook(() =>
            useUnanimousScores([newer, older, lower], members)
        );

        // Two distinct unanimous scores, sorted descending by score.
        expect(result.current.unanimousScores.map((g) => g.score)).toEqual([9, 7]);
        const nineGroup = result.current.unanimousScores[0];
        expect(nineGroup.films).toHaveLength(2);
        expect(nineGroup.namesakeFilm.title).toBe('Older Nine');
        expect(result.current.totalUnanimousCount).toBe(3);
    });

    it('resolves isLoading to false after effects run', () => {
        const { result } = renderHook(() => useUnanimousScores([makeFilm()], members));
        expect(result.current.isLoading).toBe(false);
    });
});
