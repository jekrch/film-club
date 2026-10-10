import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import FilmSearchPicker from './FilmSearchPicker';
import type { ClubAuthValue } from '../../auth/GoogleAuth';
import * as clubApi from '../../api/clubApi';
import type { FilmSearchResult } from '../../api/clubApi';

/**
 * Digging past OMDB's first ten hits: "load more" walks later pages of the
 * query on screen, and once paging can't help the picker points at the IMDb id
 * route instead.
 */

const auth: Partial<ClubAuthValue> = {
    configured: true,
    status: 'signed-in',
    member: 'Jacob',
    admin: false,
    error: null,
    withToken: jest.fn(),
};

jest.mock('../../auth/GoogleAuth', () => ({
    useClubAuth: () => auth,
}));

const film = (n: number): FilmSearchResult => ({
    imdbID: `tt${String(n).padStart(7, '0')}`,
    title: `Film ${n}`,
    year: '1980',
    poster: null,
});

const range = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => film(from + i));

const search = (query: string) =>
    fireEvent.change(screen.getByLabelText(/Add a film/i), { target: { value: query } });

// The picker debounces at 350ms.
const settle = { timeout: 2000 };

let searchFilms: jest.SpyInstance;

beforeEach(() => {
    jest.restoreAllMocks();
    auth.status = 'signed-in';
    (auth.withToken as jest.Mock).mockReset();
    (auth.withToken as jest.Mock).mockImplementation((call: (token: string) => unknown) =>
        call('token')
    );
    searchFilms = jest.spyOn(clubApi, 'searchFilms');
});

const renderPicker = () => render(<FilmSearchPicker onPick={jest.fn()} chosen={new Set()} />);

describe('FilmSearchPicker', () => {
    it('appends the next page of the same query, skipping repeats', async () => {
        searchFilms
            .mockResolvedValueOnce({ results: range(1, 10), total: 15 })
            // OMDB can repeat a hit across pages.
            .mockResolvedValueOnce({ results: [film(10), ...range(11, 15)], total: 15 });
        renderPicker();
        search('film');

        await waitFor(() => expect(screen.getByText('Film 10')).toBeInTheDocument(), settle);
        fireEvent.click(screen.getByRole('button', { name: /Load more — showing 10 of 15/ }));

        await waitFor(() => expect(screen.getByText('Film 15')).toBeInTheDocument());
        expect(searchFilms).toHaveBeenLastCalledWith('token', 'film', 2, expect.anything());
        expect(screen.getAllByText('Film 10')).toHaveLength(1);
        expect(screen.queryByRole('button', { name: /Load more/ })).not.toBeInTheDocument();
    });

    it('offers no more when the first page is everything', async () => {
        searchFilms.mockResolvedValue({ results: range(1, 3), total: 3 });
        renderPicker();
        search('film');

        await waitFor(() => expect(screen.getByText('Film 3')).toBeInTheDocument(), settle);
        expect(screen.queryByRole('button', { name: /Load more/ })).not.toBeInTheDocument();
        expect(screen.getByText(/Not here\? Paste the film's IMDb id/)).toBeInTheDocument();
    });

    it('points at the id route when a title finds nothing', async () => {
        searchFilms.mockResolvedValue({ results: [], total: 0 });
        renderPicker();
        search('no such film');

        await waitFor(
            () =>
                expect(
                    screen.getByText(/No matches\. Paste the film's IMDb id/)
                ).toBeInTheDocument(),
            settle
        );
    });

    it('says so when an id matches nothing, rather than suggesting the id', async () => {
        searchFilms.mockResolvedValue({ results: [], total: 0 });
        renderPicker();
        search('tt9999999');

        await waitFor(
            () => expect(screen.getByText('OMDb has no film with that id.')).toBeInTheDocument(),
            settle
        );
        expect(screen.queryByText(/Paste the film's IMDb id/)).not.toBeInTheDocument();
    });
});
