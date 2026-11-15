import { act, renderHook } from '@testing-library/react';

import {
    ensureFilmSummaries,
    fetchFilmSummary,
    findFilmSummary,
    resetFilmSummaries,
} from './filmSummaries';
import { useEntryDetails } from '../hooks/useEntryDetails';

jest.mock('../types/list', () => ({
    filmLists: [],
    listFilmSummaries: {
        tt0000001: { imdbID: 'tt0000001', title: 'Bundled', year: '1970', poster: null },
    },
}));

const respond = (status: number, body: unknown): Response =>
    ({ ok: status === 200, status, json: async () => body }) as unknown as Response;

const mockFetch = jest.fn();

beforeEach(() => {
    resetFilmSummaries();
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof fetch;
});

describe('ensureFilmSummaries', () => {
    it('makes no request when the bundle knows every film', async () => {
        await ensureFilmSummaries(['tt0000001']);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    // A film logged since the last full build: the data deploy published it in
    // the live index, and the bundle has never heard of it.
    it('reads the live index for a film the bundle lacks', async () => {
        mockFetch.mockResolvedValue(
            respond(200, { tt0000002: { imdbID: 'tt0000002', title: 'Since the build' } })
        );

        expect(findFilmSummary('tt0000002')).toBeUndefined();
        await ensureFilmSummaries(['tt0000001', 'tt0000002']);

        expect(mockFetch.mock.calls[0][0]).toBe('/data/films/index.json');
        expect(findFilmSummary('tt0000002')?.title).toBe('Since the build');
    });

    it('prefers the bundled record to the live one', async () => {
        mockFetch.mockResolvedValue(
            respond(200, {
                tt0000001: { title: 'Live copy' },
                tt0000002: { title: 'Since the build' },
            })
        );
        await ensureFilmSummaries(['tt0000002']);
        expect(findFilmSummary('tt0000001')?.title).toBe('Bundled');
    });

    it('resolves even when the index cannot be read', async () => {
        mockFetch.mockRejectedValue(new TypeError('offline'));
        await expect(ensureFilmSummaries(['tt0000002'])).resolves.toBeUndefined();
        expect(findFilmSummary('tt0000002')).toBeUndefined();
    });
});

describe('fetchFilmSummary', () => {
    it('reads one film, once, however many rows ask', async () => {
        mockFetch.mockResolvedValue(respond(200, { imdbID: 'tt0000001', title: 'Full' }));

        const [a, b] = await Promise.all([
            fetchFilmSummary('tt0000001'),
            fetchFilmSummary('tt0000001'),
        ]);

        expect(a?.title).toBe('Full');
        expect(b).toBe(a);
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch.mock.calls[0][0]).toBe('/data/films/tt0000001.json');
    });

    it('tries again after a failure, but not after a 404', async () => {
        mockFetch.mockRejectedValueOnce(new TypeError('offline'));
        await expect(fetchFilmSummary('tt0000001')).resolves.toBeNull();
        mockFetch.mockResolvedValueOnce(respond(404, null));
        await expect(fetchFilmSummary('tt0000001')).resolves.toBeNull();
        await expect(fetchFilmSummary('tt0000001')).resolves.toBeNull();
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });
});

describe('useEntryDetails', () => {
    const rowDetails = {
        tagline: null,
        plot: null,
        crew: [],
        ratings: [],
        stills: [],
        cast: [{ name: 'From the row', role: null, profileUrl: null, tmdbId: null }],
    };

    it("shows the full summary's details once the panel opens", async () => {
        mockFetch.mockResolvedValue(
            respond(200, { imdbID: 'tt0000001', title: 'Full', plot: 'The whole synopsis.' })
        );
        const { result } = renderHook(() => useEntryDetails('tt0000001', rowDetails, true));
        expect(result.current.details).toBe(rowDetails);

        await act(async () => {
            result.current.toggle();
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        expect(result.current.open).toBe(true);
        expect(result.current.details?.plot).toBe('The whole synopsis.');
    });

    // The fetch must not hold the click hostage on a slow network.
    it('opens with what the row has when the fetch fails', async () => {
        mockFetch.mockRejectedValue(new TypeError('offline'));
        const { result } = renderHook(() => useEntryDetails('tt0000001', rowDetails, true));

        await act(async () => {
            result.current.toggle();
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        expect(result.current.open).toBe(true);
        expect(result.current.details).toBe(rowDetails);
    });

    it('fetches nothing for a club film, whose record is already whole', () => {
        const { result } = renderHook(() => useEntryDetails('tt0000001', rowDetails, false));
        act(() => result.current.toggle());
        expect(result.current.open).toBe(true);
        expect(mockFetch).not.toHaveBeenCalled();
    });
});
