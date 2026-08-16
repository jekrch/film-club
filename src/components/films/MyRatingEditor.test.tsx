import { fireEvent, render, screen } from '@testing-library/react';

import MyRatingEditor from './MyRatingEditor';
import { makeClubInfo, makeFilm, makeRating } from '../../test-utils/factories';
import type { RatingOverride } from '../../api/clubApi';
import type { ClubAuthValue } from '../../auth/GoogleAuth';

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
        clubRatings: [makeRating({ user: 'Andy', score: 7, blurb: 'From the sheet.' })],
    }),
});

const override: RatingOverride = {
    updatedBy: 'Andy',
    updatedAt: '2026-08-12T19:04:11Z',
    score: 9,
    blurb: 'Better on a rewatch.',
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
        const { rerender } = renderEditor({ override: undefined, overridesLoading: true });
        open();

        rerender(
            <MyRatingEditor
                film={film}
                override={override}
                overridesLoading={false}
                onSaved={jest.fn()}
                onReverted={jest.fn()}
            />
        );

        expect(scoreField()).toHaveValue(9);
        expect(reviewField()).toHaveValue('Better on a rewatch.');
    });

    it('keeps what the member typed when a late override arrives', () => {
        const { rerender } = renderEditor({ override: undefined, overridesLoading: true });
        open();
        fireEvent.change(scoreField(), { target: { value: '4' } });

        rerender(
            <MyRatingEditor
                film={film}
                override={override}
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
});
