import { act, renderHook } from '@testing-library/react';
import { useProfileData } from './useProfileData';
import { teamMembers } from '../types/team';

// useProfileData reads the real bundled film/club data and scrolls on load.
beforeAll(() => {
    window.scrollTo = jest.fn();
});

describe('useProfileData', () => {
    const activeMemberName = teamMembers.find((m) => typeof m.queue === 'number' && m.queue > 0)!.name;

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
