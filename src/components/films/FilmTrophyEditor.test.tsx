import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import FilmTrophyEditor from './FilmTrophyEditor';
import { makeFilm, makeTrophy } from '../../test-utils/factories';
import type { ClubAuthValue } from '../../auth/GoogleAuth';
import * as clubApi from '../../api/clubApi';

/**
 * The panel's own behavior, with auth stubbed as a signed-in member — the test
 * env is deliberately unconfigured (`editorEnvStub`), so the real provider would
 * render this as a visitor sees it (nothing at all) and never reach the form.
 *
 * What is worth testing here is the half that isn't in `trophyEditUtils`: who
 * gets an Edit button. The worker enforces that rule too, and the tests for the
 * copy that is actually trusted live in `worker/src/validate.test.ts`.
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

const film = makeFilm({ title: 'Suspiria', imdbID: 'tt0076786' });

const mine = makeTrophy({
    id: 'andy-togetherness-trophy',
    recipient: 'Andy',
    award: 'Togetherness Trophy',
    awardedBy: 'Jacob',
});
const theirs = makeTrophy({
    id: 'jacob-bad-boy',
    recipient: 'Jacob',
    award: 'Bad Boy',
    note: 'for the group chat',
    awardedBy: 'Andy',
});

const renderEditor = (props: Partial<React.ComponentProps<typeof FilmTrophyEditor>> = {}) =>
    render(
        <MemoryRouter>
            <FilmTrophyEditor
                film={film}
                trophies={[]}
                loading={false}
                onSaved={jest.fn()}
                onWithdrawn={jest.fn()}
                {...props}
            />
        </MemoryRouter>
    );

const open = () => fireEvent.click(screen.getByRole('button', { name: /Award a trophy/i }));

beforeEach(() => {
    auth.member = 'Jacob';
    auth.admin = false;
    jest.restoreAllMocks();
});

describe('FilmTrophyEditor', () => {
    it('offers nothing to a signed-out visitor', () => {
        auth.status = 'signed-out';
        const { container } = renderEditor();

        expect(container).toBeEmptyDOMElement();
        auth.status = 'signed-in';
    });

    it('stays collapsed until asked for', () => {
        renderEditor();

        expect(screen.queryByLabelText(/Trophy/i)).not.toBeInTheDocument();
    });

    it('lists the awards already given, with who gave them', () => {
        renderEditor({ trophies: [mine, theirs] });
        open();

        expect(screen.getByText('Togetherness Trophy')).toBeInTheDocument();
        expect(screen.getByText('for the group chat')).toBeInTheDocument();
        expect(screen.getByText(/given by Andy/)).toBeInTheDocument();
    });

    it('offers Edit only on the awards this member handed out', () => {
        renderEditor({ trophies: [mine, theirs] });
        open();

        // One award of the two is Jacob's to change; the other is Andy's.
        expect(screen.getAllByRole('button', { name: /^Edit$/i })).toHaveLength(1);
        expect(screen.getAllByRole('button', { name: /Withdraw/i })).toHaveLength(1);
    });

    it('lets an admin change anyone’s', () => {
        auth.admin = true;
        renderEditor({ trophies: [mine, theirs] });
        open();

        expect(screen.getAllByRole('button', { name: /^Edit$/i })).toHaveLength(2);
    });

    it('reports a missing trophy name rather than sending it', async () => {
        const put = jest.spyOn(clubApi, 'putTrophy');
        renderEditor();
        open();
        fireEvent.click(screen.getByRole('button', { name: /Award a trophy/i }));
        fireEvent.click(screen.getByRole('button', { name: /Award it/i }));

        expect(await screen.findByText('Give the trophy a name.')).toBeInTheDocument();
        expect(put).not.toHaveBeenCalled();
    });

    it('saves a new award and hands the stored record back', async () => {
        const saved = makeTrophy({ recipient: 'Andy', award: 'Helmet', awardedBy: 'Jacob' });
        const onSaved = jest.fn();
        (auth.withToken as jest.Mock).mockImplementation(() =>
            Promise.resolve({ trophy: saved, created: true, changed: true })
        );

        renderEditor({ onSaved });
        open();
        fireEvent.click(screen.getByRole('button', { name: /Award a trophy/i }));
        fireEvent.change(screen.getByPlaceholderText('Togetherness Trophy'), {
            target: { value: 'Helmet' },
        });
        fireEvent.click(screen.getByRole('button', { name: /Award it/i }));

        await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
        // The save is live at the next Pages build, so the panel says so rather
        // than pretending to wait on it.
        expect(screen.getByText(/live on the site in about a minute/i)).toBeInTheDocument();
    });

    it('confirms before withdrawing, then reports it', async () => {
        const onWithdrawn = jest.fn();
        (auth.withToken as jest.Mock).mockImplementation(() =>
            Promise.resolve({ imdbID: film.imdbID, id: mine.id, deleted: true })
        );

        renderEditor({ trophies: [mine], onWithdrawn });
        open();
        fireEvent.click(screen.getByRole('button', { name: /Withdraw/i }));
        expect(screen.getByText(/Take this trophy back\?/i)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /^Withdraw$/i }));

        await waitFor(() => expect(onWithdrawn).toHaveBeenCalledWith(mine.id));
        expect(screen.getByText(/Withdrew the Togetherness Trophy/i)).toBeInTheDocument();
    });

    it('surfaces the worker’s refusal in the member’s words', async () => {
        (auth.withToken as jest.Mock).mockImplementation(() =>
            Promise.reject(new clubApi.ClubApiError(403, 'Andy handed out the Bad Boy.'))
        );

        renderEditor();
        open();
        fireEvent.click(screen.getByRole('button', { name: /Award a trophy/i }));
        fireEvent.change(screen.getByPlaceholderText('Togetherness Trophy'), {
            target: { value: 'Helmet' },
        });
        fireEvent.click(screen.getByRole('button', { name: /Award it/i }));

        expect(await screen.findByText('Andy handed out the Bad Boy.')).toBeInTheDocument();
    });
});
