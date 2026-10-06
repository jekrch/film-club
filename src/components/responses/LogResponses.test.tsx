import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import LogResponses from './LogResponses';
import { ResponsesProvider } from '../../contexts/ResponsesContext';
import type { ClubAuthValue } from '../../auth/GoogleAuth';
import * as clubApi from '../../api/clubApi';
import type { ResponseThread } from '../../types/responses';

/**
 * The row under a log entry, against the real provider with the worker calls
 * stubbed. What's worth pinning down here is who gets offered what. The rules
 * that are actually trusted live in `worker/src/validate.test.ts`.
 */

const auth: Partial<ClubAuthValue> = {
    configured: true,
    status: 'signed-in',
    member: 'Jacob',
    admin: false,
    error: null,
    withToken: <T,>(call: (token: string) => Promise<T>) => call('token'),
};

jest.mock('../../auth/GoogleAuth', () => ({
    useClubAuth: () => auth,
}));

const THREAD = 'log-Gabe-tt0046478';

/** What the bundle holds. Replaced per test; the live read never lands. */
let bundled: Record<string, ResponseThread> = {};

jest.mock('../../types/responses', () => {
    const actual = jest.requireActual('../../types/responses');
    return {
        ...actual,
        get bundledResponses() {
            return { threads: bundled };
        },
    };
});

jest.mock('../../api/repoData', () => {
    const actual = jest.requireActual('../../api/repoData');
    return { ...actual, fetchResponses: () => new Promise(() => {}) };
});

const renderRow = (owner = 'Gabe') =>
    render(
        <ResponsesProvider>
            <MemoryRouter>
                <LogResponses threadId={THREAD} owner={owner} title="Ugetsu" />
            </MemoryRouter>
        </ResponsesProvider>
    );

const comment = (id: string, author: string) => ({
    id,
    author,
    body: `${author} was here`,
    createdAt: '2026-10-01T12:00:00Z',
    editedAt: null,
});

beforeEach(() => {
    sessionStorage.clear();
    jest.restoreAllMocks();
    bundled = {};
    auth.status = 'signed-in';
    auth.member = 'Jacob';
    auth.admin = false;
});

describe('LogResponses', () => {
    it('draws nothing for a visitor when nobody has responded', () => {
        auth.status = 'signed-out';
        const { container } = renderRow();
        expect(container).toBeEmptyDOMElement();
    });

    it('shows a visitor the reactions, read-only, one pill per member', () => {
        auth.status = 'signed-out';
        bundled = {
            [THREAD]: {
                reactions: { like: ['Andy'], clap: ['Andy', 'Mark'] },
                comments: [],
            },
        };
        renderRow();

        expect(screen.getByRole('group', { name: 'Andy: Like, Bravo' })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Mark: Bravo' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /React to/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Take back/ })).not.toBeInTheDocument();
    });

    it('lists who reacted with what at the head of the comments', () => {
        bundled = {
            [THREAD]: {
                reactions: { like: ['Andy'], fire: ['Andy', 'Mark'] },
                comments: [comment('a', 'Andy')],
            },
        };
        renderRow();
        fireEvent.click(screen.getByRole('button', { name: /1 comment/i }));

        const [andy, mark] = within(screen.getByRole('list', { name: 'Reactions' })).getAllByRole(
            'listitem'
        );
        expect(andy).toHaveTextContent('AndyLike, Fire');
        expect(mark).toHaveTextContent('MarkFire');
    });

    it('lets you take back your own reaction, and only yours, from the bar', async () => {
        const remove = jest.spyOn(clubApi, 'deleteReaction').mockResolvedValue({
            threadId: THREAD,
            thread: { reactions: { fire: ['Andy'] }, comments: [] },
            changed: true,
        });
        bundled = { [THREAD]: { reactions: { fire: ['Andy', 'Jacob'] }, comments: [] } };
        renderRow();

        expect(screen.getAllByRole('button', { name: /Take back/ })).toHaveLength(1);
        fireEvent.click(screen.getByRole('button', { name: 'Take back your Fire' }));

        expect(screen.queryByRole('group', { name: /^Jacob/ })).not.toBeInTheDocument();
        await waitFor(() => expect(remove).toHaveBeenCalledWith('token', THREAD, 'fire'));
    });

    it('shows a reaction at once and sends it', async () => {
        const put = jest.spyOn(clubApi, 'putReaction').mockResolvedValue({
            threadId: THREAD,
            thread: { reactions: { 'mind-blown': ['Jacob'] }, comments: [] },
            changed: true,
        });
        renderRow();

        fireEvent.click(screen.getByRole('button', { name: 'React to Ugetsu' }));
        fireEvent.click(screen.getByRole('button', { name: 'Mind-blown' }));

        expect(screen.getByRole('group', { name: 'Jacob: Mind-blown' })).toBeInTheDocument();
        await waitFor(() => expect(put).toHaveBeenCalledWith('token', THREAD, 'mind-blown'));
    });

    it('keeps the rest behind More until asked', async () => {
        const put = jest.spyOn(clubApi, 'putReaction').mockResolvedValue({
            threadId: THREAD,
            thread: { reactions: { 'chefs-kiss': ['Jacob'] }, comments: [] },
            changed: true,
        });
        renderRow();

        fireEvent.click(screen.getByRole('button', { name: 'React to Ugetsu' }));
        expect(screen.queryByRole('button', { name: "Chef's kiss" })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'More reactions' }));
        fireEvent.click(screen.getByRole('button', { name: "Chef's kiss" }));

        expect(screen.getByRole('group', { name: "Jacob: Chef's kiss" })).toBeInTheDocument();
        await waitFor(() => expect(put).toHaveBeenCalledWith('token', THREAD, 'chefs-kiss'));
    });

    it('takes an optimistic reaction back when the save fails', async () => {
        jest.spyOn(clubApi, 'putReaction').mockRejectedValue(new Error('GitHub is down.'));
        renderRow();

        fireEvent.click(screen.getByRole('button', { name: 'React to Ugetsu' }));
        fireEvent.click(screen.getByRole('button', { name: 'Bravo' }));

        expect(await screen.findByText('GitHub is down.')).toBeInTheDocument();
        expect(screen.queryByRole('group', { name: /^Jacob/ })).not.toBeInTheDocument();
    });

    it('offers edit on your own comment and nothing on a third member’s', () => {
        bundled = {
            [THREAD]: { reactions: {}, comments: [comment('j', 'Jacob'), comment('a', 'Andy')] },
        };
        renderRow();
        fireEvent.click(screen.getByRole('button', { name: /2 comments/i }));

        const [mine, theirs] = screen.getAllByRole('listitem');
        expect(within(mine).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
        expect(within(mine).getByRole('button', { name: 'Remove' })).toBeInTheDocument();
        expect(within(theirs).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
        expect(within(theirs).queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    });

    it('lets the log’s owner remove anyone’s comment, but not reword it', () => {
        auth.member = 'Gabe';
        bundled = { [THREAD]: { reactions: {}, comments: [comment('a', 'Andy')] } };
        renderRow();
        fireEvent.click(screen.getByRole('button', { name: /1 comment/i }));

        const row = screen.getByRole('listitem');
        expect(within(row).getByRole('button', { name: 'Remove' })).toBeInTheDocument();
        expect(within(row).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    });

    it('posts a new comment and shows what the worker stored', async () => {
        const stored = comment('jacob-20261005t140211', 'Jacob');
        const put = jest.spyOn(clubApi, 'putComment').mockResolvedValue({
            threadId: THREAD,
            thread: { reactions: {}, comments: [stored] },
            comment: stored,
            created: true,
            changed: true,
        });
        renderRow();

        fireEvent.click(screen.getByRole('button', { name: /^Comment$/i }));
        fireEvent.change(screen.getByLabelText('Write a comment'), {
            target: { value: '  Jacob was here ' },
        });
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Post' }));
        });

        expect(put).toHaveBeenCalledWith('token', THREAD, clubApi.NEW_COMMENT_ID, {
            body: 'Jacob was here',
        });
        expect(screen.getByRole('listitem')).toHaveTextContent('Jacob was here');
        expect(screen.getByLabelText('Write a comment')).toHaveValue('');
    });
});
