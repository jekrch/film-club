import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import EditLogDialog from './EditLogDialog';
import type { ClubAuthValue } from '../../auth/GoogleAuth';
import { clearWrites, pendingWrites, writeKeys } from '../../api/writeCache';
import type { LogEvent } from '../../utils/wallUtils';

/** Signed in as Jacob; the test env is unconfigured, so auth is stubbed. */
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
const deleteWatched = jest.fn();

jest.mock('../../api/clubApi', () => ({
    putWatched: (...args: unknown[]) => putWatched(...args),
    deleteWatched: (...args: unknown[]) => deleteWatched(...args),
}));

const logEvent = (member: string): LogEvent => ({
    id: `log:${member}:tt0081505`,
    kind: 'log',
    date: '2026-10-03',
    at: null,
    wash: null,
    member,
    entry: {
        imdbID: 'tt0081505',
        watchDate: '2026-10-03',
        score: 8,
        scoreQualifier: null,
        blurb: 'Saw this on 35mm.',
        title: 'The Shining',
        year: '1980',
        poster: null,
        resolvedTrailerKey: null,
        details: null,
        backdropImages: [],
    },
});

const renderDialog = (member = 'Jacob') => {
    const onClose = jest.fn();
    const onChanged = jest.fn();
    render(
        <EditLogDialog event={logEvent(member)} isOpen onClose={onClose} onChanged={onChanged} />
    );
    return { onClose, onChanged };
};

describe('EditLogDialog', () => {
    beforeEach(() => {
        // The dialog's scroll lock restores the page's position on close,
        // which jsdom doesn't implement.
        window.scrollTo = jest.fn();
        clearWrites();
        putWatched.mockReset();
        deleteWatched.mockReset();
    });

    it('opens on the entry as it stands', () => {
        renderDialog();
        expect(screen.getByLabelText(/Score/i)).toHaveValue(8);
        expect(screen.getByLabelText(/Review/i)).toHaveValue('Saw this on 35mm.');
    });

    it('saves only what changed, records it, and closes', async () => {
        const saved = { ...logEvent('Jacob').entry, score: 9 };
        putWatched.mockResolvedValue({ entry: saved, created: false, changed: true });
        const { onClose, onChanged } = renderDialog();

        fireEvent.change(screen.getByLabelText(/Score/i), { target: { value: '9' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(putWatched).toHaveBeenCalledWith('token', 'tt0081505', { score: 9 });
        expect(onChanged).toHaveBeenCalled();
        expect(pendingWrites('watched').get(writeKeys.watched('Jacob', 'tt0081505'))).toEqual(
            saved
        );
    });

    it("names the owner when an admin edits someone else's entry", async () => {
        putWatched.mockResolvedValue({ entry: logEvent('Gabe').entry, changed: true });
        const { onClose } = renderDialog('Gabe');

        expect(screen.getByText("Gabe's log")).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText(/Score/i), { target: { value: '9' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(putWatched).toHaveBeenCalledWith('token', 'tt0081505', {
            score: 9,
            owner: 'Gabe',
        });
    });

    it('removes the entry after a confirmation, leaving a tombstone', async () => {
        deleteWatched.mockResolvedValue({ imdbID: 'tt0081505', owner: 'Jacob', deleted: true });
        const { onClose, onChanged } = renderDialog();

        fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
        expect(screen.getByText(/Drop The Shining from your log/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(deleteWatched).toHaveBeenCalledWith('token', 'tt0081505', undefined);
        expect(onChanged).toHaveBeenCalled();
        expect(pendingWrites('watched').get(writeKeys.watched('Jacob', 'tt0081505'))).toBeNull();
    });

    it("keeps the dialog open with the worker's message when a save fails", async () => {
        putWatched.mockRejectedValue(new Error('score: must be between 0 and 9'));
        const { onClose } = renderDialog();

        fireEvent.change(screen.getByLabelText(/Score/i), { target: { value: '7' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(await screen.findByText(/must be between 0 and 9/)).toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
    });
});
