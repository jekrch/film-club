import { act, renderHook } from '@testing-library/react';
import { useFilmFiltering, getSortOptionDisplayName } from './useFilmFilter';
import { makeFilm, makeClubInfo, makeRating } from '../test-utils/factories';

const films = [
    makeFilm({
        title: 'Alpha',
        year: '2001',
        genre: 'Drama, Crime',
        director: 'Jane Doe',
        movieClubInfo: makeClubInfo({
            selector: 'Andy',
            watchDate: '01/01/2020',
            clubRatings: [makeRating({ user: 'andy', score: 5 }), makeRating({ user: 'gabe', score: 9 })],
        }),
    }),
    makeFilm({
        title: 'Beta',
        year: '1999',
        genre: 'Comedy',
        director: 'John Smith',
        movieClubInfo: makeClubInfo({
            selector: 'Gabe',
            watchDate: '01/01/2022',
            clubRatings: [makeRating({ user: 'andy', score: 8 }), makeRating({ user: 'gabe', score: 8 })],
        }),
    }),
    makeFilm({
        title: 'Gamma',
        year: '2010',
        genre: 'Drama',
        director: 'Jane Doe',
        movieClubInfo: makeClubInfo({
            selector: 'Andy',
            watchDate: '01/01/2018',
            clubRatings: [], // no ratings
        }),
    }),
];

describe('useFilmFilter', () => {
    describe('getSortOptionDisplayName', () => {
        it('maps known sort options to labels', () => {
            expect(getSortOptionDisplayName('title')).toBe('Title');
            expect(getSortOptionDisplayName('clubRating')).toBe('Club Rating');
            expect(getSortOptionDisplayName('watchDate')).toBe('Watch Date');
            expect(getSortOptionDisplayName('controversial')).toBe('Controversial');
        });

        it('capitalizes member names for member sort options', () => {
            expect(getSortOptionDisplayName('andy')).toBe('Andy');
        });
    });

    it('derives the genre and selector option lists', () => {
        const { result } = renderHook(() => useFilmFiltering(films));
        expect(result.current.allGenres).toEqual(['Comedy', 'Crime', 'Drama']);
        expect(result.current.allSelectors).toEqual(['Andy', 'Gabe']);
    });

    it('defaults to sorting by watch date descending', () => {
        const { result } = renderHook(() => useFilmFiltering(films));
        expect(result.current.sortBy).toBe('watchDate');
        expect(result.current.sortDirection).toBe('desc');
        expect(result.current.filteredFilms.map((f) => f.title)).toEqual([
            'Beta', // 2022
            'Alpha', // 2020
            'Gamma', // 2018
        ]);
    });

    it('filters by search term across title and director', () => {
        const { result } = renderHook(() => useFilmFiltering(films));
        act(() => result.current.setSearchTerm('jane doe'));
        expect(result.current.filteredFilms.map((f) => f.title).sort()).toEqual(['Alpha', 'Gamma']);

        act(() => result.current.setSearchTerm('beta'));
        expect(result.current.filteredFilms.map((f) => f.title)).toEqual(['Beta']);
    });

    it('filters by genre', () => {
        const { result } = renderHook(() => useFilmFiltering(films));
        act(() => result.current.setSelectedGenre('Comedy'));
        expect(result.current.filteredFilms.map((f) => f.title)).toEqual(['Beta']);
    });

    it('filters by selector', () => {
        const { result } = renderHook(() => useFilmFiltering(films));
        act(() => result.current.setSelectedSelector('Andy'));
        expect(result.current.filteredFilms.map((f) => f.title).sort()).toEqual(['Alpha', 'Gamma']);
    });

    it('restricts to rated films and sorts by club average when sorting by clubRating', () => {
        const { result } = renderHook(() => useFilmFiltering(films));
        act(() => result.current.handleSortChange('clubRating'));
        // Gamma has no ratings so is excluded; Beta (avg 8) above Alpha (avg 7) descending.
        expect(result.current.filteredFilms.map((f) => f.title)).toEqual(['Beta', 'Alpha']);
    });

    it('toggles sort direction when the same option is selected again', () => {
        const { result } = renderHook(() => useFilmFiltering(films));
        act(() => result.current.handleSortChange('title')); // asc by default for title
        expect(result.current.sortDirection).toBe('asc');
        expect(result.current.filteredFilms.map((f) => f.title)).toEqual(['Alpha', 'Beta', 'Gamma']);

        act(() => result.current.handleSortChange('title')); // toggle to desc
        expect(result.current.sortDirection).toBe('desc');
        expect(result.current.filteredFilms.map((f) => f.title)).toEqual(['Gamma', 'Beta', 'Alpha']);
    });

    it('reports result counts in the results text', () => {
        const { result } = renderHook(() => useFilmFiltering(films));
        expect(result.current.resultsText).toBe('Showing 3 of 3 total films');
        act(() => result.current.setSearchTerm('Alpha'));
        expect(result.current.resultsText).toContain('Showing 1');
        expect(result.current.resultsText).toContain('matching criteria');
    });
});
