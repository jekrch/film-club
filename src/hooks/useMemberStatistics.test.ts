import { renderHook } from '@testing-library/react';
import { useMemberStatistics } from './useMemberStatistics';
import { makeFilm, makeClubInfo, makeRating, makeMember } from '../test-utils/factories';
import { Film } from '../types/film';
import { TeamMember } from '../types/team';

// Stable empty references. The hook's effect keys on the `films`/`teamMembers`
// identity, so passing a fresh `[]` literal each render would loop forever.
const NO_FILMS: Film[] = [];
const NO_MEMBERS: TeamMember[] = [];

const members = [
    makeMember({ name: 'Andy', queue: 1 }),
    makeMember({ name: 'Gabe', queue: 2 }),
    makeMember({ name: 'Mark' }), // inactive
];

// Two films where Andy consistently rates high and Gabe consistently rates low,
// so their avgGivenScore differs and can be highlighted high/low.
const films = [
    makeFilm({
        movieClubInfo: makeClubInfo({
            selector: 'Andy',
            clubRatings: [
                makeRating({ user: 'andy', score: 9 }),
                makeRating({ user: 'gabe', score: 3 }),
            ],
        }),
    }),
    makeFilm({
        movieClubInfo: makeClubInfo({
            selector: 'Gabe',
            clubRatings: [
                makeRating({ user: 'andy', score: 8 }),
                makeRating({ user: 'gabe', score: 4 }),
            ],
        }),
    }),
];

describe('useMemberStatistics', () => {
    it('returns empty stats when films or members are missing', () => {
        const noFilms = renderHook(() => useMemberStatistics(NO_FILMS, members));
        expect(noFilms.result.current.allMemberStats).toEqual([]);

        const noMembers = renderHook(() => useMemberStatistics(films, NO_MEMBERS));
        expect(noMembers.result.current.allMemberStats).toEqual([]);
    });

    it('computes stats only for active (queued) members', () => {
        const { result } = renderHook(() => useMemberStatistics(films, members));
        const names = result.current.allMemberStats.map((s) => s.member.name);
        expect(names).toEqual(expect.arrayContaining(['Andy', 'Gabe']));
        expect(names).not.toContain('Mark');
        expect(result.current.allMemberStats).toHaveLength(2);
    });

    it('highlights the high and low values across members', () => {
        const { result } = renderHook(() => useMemberStatistics(films, members));
        const andy = result.current.allMemberStats.find((s) => s.member.name === 'Andy')!;
        const gabe = result.current.allMemberStats.find((s) => s.member.name === 'Gabe')!;

        // Andy gives higher scores than Gabe.
        expect(andy.highlights.avgGivenScore).toBe('high');
        expect(gabe.highlights.avgGivenScore).toBe('low');
    });

    it('maps highlights to the expected CSS classes', () => {
        const { result } = renderHook(() => useMemberStatistics(films, members));
        const { getHighlightClass } = result.current;
        expect(getHighlightClass('high')).toContain('emerald');
        expect(getHighlightClass('low')).toContain('blue');
        expect(getHighlightClass(null)).toContain('slate');
    });

    it('formats years, guarding against invalid input', () => {
        const { result } = renderHook(() => useMemberStatistics(films, members));
        const { formatYear } = result.current;
        expect(formatYear(2003.6)).toBe('2004');
        expect(formatYear(null)).toBe('N/A');
        expect(formatYear(NaN)).toBe('N/A');
    });
});
