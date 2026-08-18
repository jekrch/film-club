import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import AddClubFilmPanel from './AddClubFilmPanel';
import type { ClubAuthValue } from '../../auth/GoogleAuth';
import * as clubApi from '../../api/clubApi';

/**
 * Adding a film, which used to mean opening the Google Sheet.
 *
 * The picker itself is `FilmSearchPicker` and is not re-tested here; what this
 * covers is the part that only exists on this panel — that a film the club
 * already has can't be added again, and that the submission carries the club
 * fields the member filled in.
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

const applyFilm = jest.fn();
let storedOverrides: Record<string, unknown> = {};

jest.mock('../../contexts/OverridesContext', () => ({
    useOverrides: () => ({ films: storedOverrides, applyFilm }),
}));

const hit = { imdbID: 'tt0076786', title: 'Suspiria', year: '1977', poster: null };

const open = () => fireEvent.click(screen.getByRole('button', { name: /Add a club film/i }));

const search = async (query: string) => {
    fireEvent.change(screen.getByLabelText(/Find the film/i), { target: { value: query } });
    // The picker debounces at 350ms.
    await waitFor(() => expect(screen.getByText('Suspiria')).toBeInTheDocument(), {
        timeout: 2000,
    });
};

beforeEach(() => {
    jest.restoreAllMocks();
    applyFilm.mockReset();
    storedOverrides = {};
    auth.status = 'signed-in';
    (auth.withToken as jest.Mock).mockReset();
    (auth.withToken as jest.Mock).mockImplementation((call: (token: string) => unknown) =>
        call('token')
    );
    jest.spyOn(clubApi, 'searchFilms').mockResolvedValue([hit]);
});

describe('AddClubFilmPanel', () => {
    it('offers nothing to a signed-out visitor', () => {
        auth.status = 'signed-out';
        const { container } = render(<AddClubFilmPanel />);

        expect(container).toBeEmptyDOMElement();
    });

    it('stays collapsed until asked for', () => {
        render(<AddClubFilmPanel />);

        expect(screen.queryByLabelText(/Find the film/i)).not.toBeInTheDocument();
    });

    it('refuses to add a film already submitted but not yet deployed', async () => {
        // The film is in nobody's bundle for a minute or two after it is added;
        // the submission is the only evidence it exists.
        storedOverrides = { tt0076786: { ratings: {}, added: { addedBy: 'Andy' } } };
        render(<AddClubFilmPanel />);
        open();
        await search('suspiria');

        expect(screen.getByText('in the club')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Suspiria/ })).toBeDisabled();
    });

    it('submits the picked film with the club fields the member filled in', async () => {
        const put = jest.spyOn(clubApi, 'putFilm').mockResolvedValue({
            imdbID: hit.imdbID,
            film: { selector: 'Jacob', updatedBy: 'Jacob', updatedAt: 'x' },
            added: { addedBy: 'Jacob', addedAt: 'x', title: 'Suspiria', year: '1977' },
            created: true,
            changed: true,
        });

        render(<AddClubFilmPanel />);
        open();
        await search('suspiria');
        fireEvent.click(screen.getByRole('button', { name: /Suspiria/ }));

        fireEvent.change(screen.getByLabelText(/Watch date/i), {
            target: { value: '2026-02-03' },
        });
        fireEvent.click(screen.getByRole('button', { name: /Add the film/i }));

        await waitFor(() =>
            expect(put).toHaveBeenCalledWith('token', hit.imdbID, {
                // Seeded with the caller, since a member adding a film is
                // usually adding their own pick.
                selector: 'Jacob',
                // Converted to the form films.json stores.
                watchDate: '02/03/2026',
            })
        );
    });

    it('says the film is on its way rather than pretending it is there', async () => {
        jest.spyOn(clubApi, 'putFilm').mockResolvedValue({
            imdbID: hit.imdbID,
            film: { updatedBy: 'Jacob', updatedAt: 'x' },
            created: true,
            changed: true,
        });

        render(<AddClubFilmPanel />);
        open();
        await search('suspiria');
        fireEvent.click(screen.getByRole('button', { name: /Suspiria/ }));
        fireEvent.click(screen.getByRole('button', { name: /Add the film/i }));

        expect(await screen.findByText(/on its way/i)).toBeInTheDocument();
        expect(applyFilm).toHaveBeenCalledWith(
            hit.imdbID,
            expect.objectContaining({
                film: {
                    updatedBy: 'Jacob',
                    updatedAt: 'x',
                },
            })
        );
    });
});
