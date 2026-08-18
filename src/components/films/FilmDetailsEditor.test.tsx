import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import FilmDetailsEditor from './FilmDetailsEditor';
import { makeClubInfo, makeFilm } from '../../test-utils/factories';
import type { FilmOverride } from '../../api/clubApi';
import type { ClubAuthValue } from '../../auth/GoogleAuth';
import * as clubApi from '../../api/clubApi';

/**
 * The panel's own behavior, with auth stubbed as a signed-in member — the test
 * env is deliberately unconfigured (`editorEnvStub`), so the real provider would
 * render this as a visitor sees it (nothing at all) and never reach the form.
 *
 * The parsing and diffing live in `filmEditUtils` and are tested there. What is
 * left here is what the panel does with them: which values it seeds, which
 * fields it sends, and that reverting is offered only where there is something
 * to revert to.
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

const film = makeFilm({
    title: 'Suspiria',
    imdbID: 'tt0076786',
    poster: 'https://omdb/suspiria.jpg',
    movieClubInfo: makeClubInfo({ selector: 'Mark', watchDate: '08/12/2020' }),
});

const override: FilmOverride = {
    updatedBy: 'Jacob',
    updatedAt: '2026-08-12T19:04:11Z',
    backdropImage: 'https://curated/hero.jpg',
};

const renderEditor = (props: Partial<React.ComponentProps<typeof FilmDetailsEditor>> = {}) =>
    render(
        <FilmDetailsEditor
            film={film}
            loading={false}
            onSaved={jest.fn()}
            onReverted={jest.fn()}
            {...props}
        />
    );

const open = () => fireEvent.click(screen.getByRole('button', { name: /Edit film details/i }));
const dateField = () => screen.getByLabelText(/Watch date/i);
const coverField = () => screen.getByLabelText(/Alternate cover/i);
const heroField = () => screen.getByLabelText(/Hero background/i);

beforeEach(() => {
    auth.status = 'signed-in';
    auth.member = 'Jacob';
    jest.restoreAllMocks();
    // Hands the token straight to the call, so the spies below see the request
    // the panel actually built.
    (auth.withToken as jest.Mock).mockReset();
    (auth.withToken as jest.Mock).mockImplementation((call: (token: string) => unknown) =>
        call('token')
    );
});

describe('FilmDetailsEditor', () => {
    it('offers nothing to a signed-out visitor', () => {
        auth.status = 'signed-out';
        const { container } = renderEditor();

        expect(container).toBeEmptyDOMElement();
    });

    it('stays collapsed until asked for', () => {
        renderEditor();

        expect(screen.queryByLabelText(/Watch date/i)).not.toBeInTheDocument();
    });

    it('seeds from the film where nobody has overridden a field', () => {
        renderEditor();
        open();

        // Stored as MM/DD/YYYY; a date input speaks only ISO.
        expect(dateField()).toHaveValue('2020-08-12');
        expect(coverField()).toHaveValue('https://omdb/suspiria.jpg');
    });

    it('prefers an override where one exists', () => {
        renderEditor({ override });
        open();

        expect(heroField()).toHaveValue('https://curated/hero.jpg');
        // Untouched by the override, so still the film's own.
        expect(coverField()).toHaveValue('https://omdb/suspiria.jpg');
    });

    it('leaves Save disabled until something actually changes', () => {
        renderEditor();
        open();
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

        fireEvent.change(heroField(), { target: { value: 'https://new/hero.jpg' } });
        expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });

    it('sends only the field the member changed', async () => {
        const onSaved = jest.fn();
        const stored = { ...override, backdropImage: 'https://new/hero.jpg' };
        const put = jest.spyOn(clubApi, 'putFilm').mockResolvedValue({
            imdbID: film.imdbID,
            film: stored,
            created: false,
            changed: true,
        });

        renderEditor({ onSaved });
        open();
        fireEvent.change(heroField(), { target: { value: 'https://new/hero.jpg' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        // The omission is the point: a patch carrying `selector` would make the
        // sheet's value inert on a field this member never looked at.
        await waitFor(() =>
            expect(put).toHaveBeenCalledWith('token', film.imdbID, {
                backdropImage: 'https://new/hero.jpg',
            })
        );
        expect(onSaved).toHaveBeenCalledWith({ film: stored, added: undefined });
        // A save is live at the next Pages build, so the panel says so rather
        // than pretending to wait on it.
        expect(screen.getByText(/live on the site in about a minute/i)).toBeInTheDocument();
    });

    it('reports a bad image link rather than sending it', async () => {
        renderEditor();
        open();
        fireEvent.change(coverField(), { target: { value: 'http://insecure.jpg' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(await screen.findByText(/Cover image:/)).toBeInTheDocument();
        expect(auth.withToken).not.toHaveBeenCalled();
    });

    it('offers a revert only where a member has overridden something', () => {
        renderEditor();
        open();
        expect(screen.queryByRole('button', { name: /Revert/i })).not.toBeInTheDocument();

        renderEditor({ override });
        fireEvent.click(screen.getAllByRole('button', { name: /Edit film details/i })[0]);
        expect(screen.getAllByRole('button', { name: /Revert to the sheet/i }).length).toBe(1);
    });

    it('says the film was withdrawn when the revert removed it', async () => {
        jest.spyOn(clubApi, 'deleteFilm').mockResolvedValue({
            imdbID: film.imdbID,
            withdrawn: true,
            reverted: true,
        });

        renderEditor({
            override,
            added: { addedBy: 'Jacob', addedAt: 'x', title: 'Suspiria', year: '1977' },
        });
        open();
        fireEvent.click(screen.getByRole('button', { name: /Revert to the sheet/i }));
        fireEvent.click(screen.getByRole('button', { name: /^Revert$/i }));

        expect(await screen.findByText(/won't be added/i)).toBeInTheDocument();
    });

    it('credits the member who added a film submitted here', () => {
        renderEditor({
            added: { addedBy: 'Andy', addedAt: 'x', title: 'Suspiria', year: '1977' },
        });
        open();

        expect(screen.getByText(/Andy added this film on the site/)).toBeInTheDocument();
    });
});
