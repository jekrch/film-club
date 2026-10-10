import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import LogFilmDialog from './LogFilmDialog';
import type { ClubAuthValue } from '../../auth/GoogleAuth';
import { clearWrites, pendingWrites, writeKeys } from '../../api/writeCache';
import type { WatchedEntry } from '../../types/watched';

/**
 * Auth stubbed as a signed-in member and the search stubbed to one hit: the
 * test env is unconfigured, and what's under test is what a pick does.
 */
const auth: Partial<ClubAuthValue> = {
    configured: true,
    status: 'signed-in',
    member: 'Jacob',
    withToken: ((call: (token: string) => Promise<unknown>) => call('token')) as never,
};

jest.mock('../../auth/GoogleAuth', () => ({
    useClubAuth: () => auth,
}));

const putWatched = jest.fn();

jest.mock('../../api/clubApi', () => ({
    putWatched: (...args: unknown[]) => putWatched(...args),
}));

jest.mock('../films/FilmSearchPicker', () => ({
    __esModule: true,
    default: ({
        onPick,
        chosen,
    }: {
        onPick: (hit: { imdbID: string; title: string }) => void;
        chosen: ReadonlySet<string>;
    }) => (
        <button
            type="button"
            disabled={chosen.has('tt0079944')}
            onClick={() => onPick({ imdbID: 'tt0079944', title: 'Stalker' })}
        >
            Pick Stalker
        </button>
    ),
}));

const entry = { imdbID: 'tt0079944', watchDate: '2026-10-09' } as WatchedEntry;

const renderDialog = (props: Partial<React.ComponentProps<typeof LogFilmDialog>> = {}) => {
    const onLogged = jest.fn();
    const onClose = jest.fn();
    render(
        <LogFilmDialog
            isOpen
            onClose={onClose}
            member="Jacob"
            logged={new Set()}
            onLogged={onLogged}
            {...props}
        />
    );
    return { onLogged, onClose };
};

describe('LogFilmDialog', () => {
    beforeEach(() => {
        // The dialog's scroll lock restores the page's position on close,
        // which jsdom doesn't implement.
        window.scrollTo = jest.fn();
        clearWrites();
        putWatched.mockReset();
    });

    it("logs the pick to the reader's own log as watched today, then closes", async () => {
        putWatched.mockResolvedValue({ entry, created: true, changed: true });
        const { onLogged, onClose } = renderDialog();

        fireEvent.click(screen.getByRole('button', { name: 'Pick Stalker' }));
        await waitFor(() => expect(onClose).toHaveBeenCalled());

        expect(putWatched).toHaveBeenCalledWith('token', 'tt0079944', {
            watchDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        });
        expect(onLogged).toHaveBeenCalledWith(entry, 'Stalker');
        // Recorded, so the wall and the log page both show it before deploy.
        expect(pendingWrites('watched').get(writeKeys.watched('Jacob', 'tt0079944'))).toEqual(
            entry
        );
    });

    it("keeps the dialog open with the worker's message when the save fails", async () => {
        putWatched.mockRejectedValue(new Error('A watch log holds at most 2000 films.'));
        const { onLogged, onClose } = renderDialog();

        fireEvent.click(screen.getByRole('button', { name: 'Pick Stalker' }));

        expect(await screen.findByText(/at most 2000 films/)).toBeInTheDocument();
        expect(onLogged).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
    });

    it('offers a film already in the log as taken', () => {
        renderDialog({ logged: new Set(['tt0079944']) });
        expect(screen.getByRole('button', { name: 'Pick Stalker' })).toBeDisabled();
    });
});
