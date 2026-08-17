import { act, renderHook } from '@testing-library/react';
import { useProfileData } from './useProfileData';
import { teamMembers } from '../types/team';

// useProfileData reads the real bundled film/club data and scrolls on load.
beforeAll(() => {
    window.scrollTo = jest.fn();
});

describe('useProfileData', () => {
    const activeMemberName = teamMembers.find(
        (m) => typeof m.queue === 'number' && m.queue > 0
    )!.name;

    it('reports an error when no member name is provided', () => {
        const { result } = renderHook(() => useProfileData(undefined));
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe('Member name is missing.');
        expect(result.current.member).toBeNull();
    });

    it('reports an error for an unknown member', () => {
        const { result } = renderHook(() => useProfileData('Nobody'));
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toContain('not found');
        expect(result.current.member).toBeNull();
    });

    it('loads data for a known active member', () => {
        const { result } = renderHook(() => useProfileData(activeMemberName));
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
        expect(result.current.member?.name).toBe(activeMemberName);
        expect(Array.isArray(result.current.selectedFilms)).toBe(true);
        expect(Array.isArray(result.current.topRatedFilms)).toBe(true);
        expect(result.current.currentUserStats).not.toBeNull();
        expect(result.current.rankings).not.toBeNull();
    });

    it('decodes URL-encoded member names', () => {
        const { result } = renderHook(() => useProfileData(encodeURIComponent(activeMemberName)));
        expect(result.current.member?.name).toBe(activeMemberName);
    });

    /**
     * These pin the shape of the controversial-films list, which was computed
     * alongside a dead in-place `sort()` of the state array it was about to
     * replace. Deleting that is invisible to the four assertions above.
     */
    describe('mostControversialFilms', () => {
        it('returns at most four, ordered by distance from the rest of the club', () => {
            const { result } = renderHook(() => useProfileData(activeMemberName));
            const films = result.current.mostControversialFilms;

            expect(films.length).toBeGreaterThan(0);
            expect(films.length).toBeLessThanOrEqual(4);

            // Ordered by *magnitude*: sitting 3 below the club is as
            // controversial as sitting 3 above it.
            const magnitudes = films.map((film) => Math.abs(film.divergence));
            expect(magnitudes).toEqual([...magnitudes].sort((a, b) => b - a));

            // Ordering alone is not enough to pin the *direction* of the sort.
            // Reversing the comparator selects the four films the member agreed
            // most closely on, and those are all exact ties at zero divergence —
            // which is still trivially "in descending order". Requiring the head
            // of the list to be a real disagreement is what rules that out.
            expect(magnitudes[0]).toBeGreaterThan(0);
        });

        it('keeps divergence signed, so loving and hating a film stay distinguishable', () => {
            const { result } = renderHook(() => useProfileData(activeMemberName));

            result.current.mostControversialFilms.forEach((film) => {
                // Nullable on the type, never null on this path: an entry is only
                // pushed when at least one other member rated the film, which is
                // the same condition that produces the average.
                expect(film.othersAvgScore).not.toBeNull();
                expect(film.divergence).toBeCloseTo(film.userScore - film.othersAvgScore!, 5);
                expect(film.memberName).toBe(activeMemberName);
            });
        });

        it('replaces the list wholesale when the member changes', () => {
            const activeMembers = teamMembers.filter(
                (m) => typeof m.queue === 'number' && m.queue > 0
            );
            const [first, second] = activeMembers;
            // Needs two members to say anything; the club has six.
            expect(second).toBeDefined();

            const { result, rerender } = renderHook(({ name }) => useProfileData(name), {
                initialProps: { name: first.name },
            });
            const before = result.current.mostControversialFilms;

            rerender({ name: second.name });
            const after = result.current.mostControversialFilms;

            // Not one entry of the previous member's may survive — the old code
            // sorted the outgoing state array in place, so a leak here would have
            // looked like a working list.
            expect(after).not.toBe(before);
            after.forEach((film) => expect(film.memberName).toBe(second.name));
        });
    });

    it('toggles the interview and blurbs expansion flags', () => {
        const { result } = renderHook(() => useProfileData(activeMemberName));
        expect(result.current.isInterviewExpanded).toBe(false);
        act(() => result.current.toggleInterviewExpanded());
        expect(result.current.isInterviewExpanded).toBe(true);

        expect(result.current.isBlurbsSectionExpanded).toBe(false);
        act(() => result.current.toggleBlurbsSectionExpanded());
        expect(result.current.isBlurbsSectionExpanded).toBe(true);
    });
});
