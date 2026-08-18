import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import MyRatingEditor from './MyRatingEditor';
import { makeClubInfo, makeFilm, makeRating } from '../../test-utils/factories';
import type { RatingOverride } from '../../api/clubApi';
import type { ClubAuthValue } from '../../auth/GoogleAuth';
import * as clubApi from '../../api/clubApi';

/**
 * The editor's own state, with auth stubbed as a signed-in member — the test
 * env is deliberately unconfigured (`editorEnvStub`), so the real provider
 * would render this panel as a visitor sees it and never reach the form.
 */

const auth: Partial<ClubAuthValue> = {
    configured: true,
    status: 'signed-in',
    member: 'Andy',
    admin: false,
    error: null,
    signOut: jest.fn(),
    withToken: jest.fn(),
};

jest.mock('../../auth/GoogleAuth', () => ({
    useClubAuth: () => auth,
}));

const film = makeFilm({
    title: 'Suspiria',
    imdbID: 'tt0076786',
    movieClubInfo: makeClubInfo({
        clubRatings: [
            makeRating({ user: 'Andy', score: 7, blurb: 'From the sheet.' }),
            makeRating({ user: 'Gabe', score: 3, blurb: "Gabe's row." }),
        ],
    }),
});

const ratings: Record<string, RatingOverride> = {
    andy: {
        updatedBy: 'Andy',
        updatedAt: '2026-08-12T19:04:11Z',
        score: 9,
        blurb: 'Better on a rewatch.',
    },
};

const renderEditor = (props: Partial<React.ComponentProps<typeof MyRatingEditor>> = {}) =>
    render(
        <MyRatingEditor
            film={film}
            overridesLoading={false}
            onSaved={jest.fn()}
            onReverted={jest.fn()}
            {...props}
        />
    );

const scoreField = () => screen.getByLabelText(/Score/i);
const reviewField = () => screen.getByLabelText(/Review/i);
const open = () => fireEvent.click(screen.getByRole('button', { name: /Edit my rating/i }));

describe('MyRatingEditor', () => {
    it('prefills the form with the sheet rating', () => {
        renderEditor();
        open();
        expect(scoreField()).toHaveValue(7);
        expect(reviewField()).toHaveValue('From the sheet.');
    });

    it('prefills with an override that lands after the panel is open', () => {
        const { rerender } = renderEditor({ ratings: undefined, overridesLoading: true });
        open();

        rerender(
            <MyRatingEditor
                film={film}
                ratings={ratings}
                overridesLoading={false}
                onSaved={jest.fn()}
                onReverted={jest.fn()}
            />
        );

        expect(scoreField()).toHaveValue(9);
        expect(reviewField()).toHaveValue('Better on a rewatch.');
    });

    it('keeps what the member typed when a late override arrives', () => {
        const { rerender } = renderEditor({ ratings: undefined, overridesLoading: true });
        open();
        fireEvent.change(scoreField(), { target: { value: '4' } });

        rerender(
            <MyRatingEditor
                film={film}
                ratings={ratings}
                overridesLoading={false}
                onSaved={jest.fn()}
                onReverted={jest.fn()}
            />
        );

        expect(scoreField()).toHaveValue(4);
    });

    it('leaves Save disabled until something actually changes', () => {
        renderEditor();
        open();
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

        fireEvent.change(reviewField(), { target: { value: 'From the sheet. Still great.' } });
        expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });

    /**
     * Admins get a member picker, because the club enters an evening's scores
     * together: five people say a number and one person types them in. The rule
     * is enforced again in the worker (`resolveOwner`), which is the copy that
     * is actually trusted.
     */
    describe('as an admin', () => {
        beforeEach(() => {
            auth.admin = true;
            (auth.withToken as jest.Mock).mockReset();
            (auth.withToken as jest.Mock).mockImplementation((call: (token: string) => unknown) =>
                call('token')
            );
        });

        afterEach(() => {
            auth.admin = false;
            jest.restoreAllMocks();
        });

        it('offers no picker to an ordinary member', () => {
            auth.admin = false;
            renderEditor();
            open();

            expect(
                screen.queryByRole('combobox', { name: /Whose rating/i })
            ).not.toBeInTheDocument();
        });

        it('shows the picked member’s row, not the caller’s', () => {
            renderEditor();
            open();
            fireEvent.click(screen.getByRole('combobox', { name: /Whose rating/i }));
            fireEvent.click(screen.getByRole('option', { name: 'Gabe' }));

            expect(scoreField()).toHaveValue(3);
            expect(reviewField()).toHaveValue("Gabe's row.");
        });

        it('discards a half-typed rating when the picker moves', () => {
            // The failure this guards against writes Andy's 9 onto Gabe's row
            // and reports it as a successful save.
            renderEditor();
            open();
            fireEvent.change(scoreField(), { target: { value: '9' } });

            fireEvent.click(screen.getByRole('combobox', { name: /Whose rating/i }));
            fireEvent.click(screen.getByRole('option', { name: 'Gabe' }));

            expect(scoreField()).toHaveValue(3);
        });

        it('names the owner on a write for someone else, and not on their own', async () => {
            const put = jest.spyOn(clubApi, 'putRating').mockResolvedValue({
                imdbID: film.imdbID,
                owner: 'Gabe',
                rating: { updatedBy: 'Andy', updatedAt: 'x', score: 5 },
                changed: true,
            });

            renderEditor();
            open();
            fireEvent.click(screen.getByRole('combobox', { name: /Whose rating/i }));
            fireEvent.click(screen.getByRole('option', { name: 'Gabe' }));
            fireEvent.change(scoreField(), { target: { value: '5' } });
            fireEvent.click(screen.getByRole('button', { name: 'Save' }));

            await waitFor(() =>
                expect(put).toHaveBeenCalledWith('token', film.imdbID, {
                    score: 5,
                    owner: 'Gabe',
                })
            );
        });

        it('keys the saved row by its owner rather than by who typed it', async () => {
            const rating = { updatedBy: 'Andy', updatedAt: 'x', score: 5 };
            jest.spyOn(clubApi, 'putRating').mockResolvedValue({
                imdbID: film.imdbID,
                owner: 'Gabe',
                rating,
                changed: true,
            });
            const onSaved = jest.fn();

            renderEditor({ onSaved });
            open();
            fireEvent.click(screen.getByRole('combobox', { name: /Whose rating/i }));
            fireEvent.click(screen.getByRole('option', { name: 'Gabe' }));
            fireEvent.change(scoreField(), { target: { value: '5' } });
            fireEvent.click(screen.getByRole('button', { name: 'Save' }));

            await waitFor(() => expect(onSaved).toHaveBeenCalledWith('Gabe', rating));
        });
    });
});
