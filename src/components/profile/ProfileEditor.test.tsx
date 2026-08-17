import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import ProfileEditor from './ProfileEditor';
import { makeMember } from '../../test-utils/factories';
import type { ClubAuthValue } from '../../auth/GoogleAuth';
import type { ProfileImageResult, ProfileWriteResult } from '../../api/clubApi';

/**
 * The two halves of the editor that aren't a text field: an uploaded picture,
 * which saves on its own, and the banner choice, which saves with everything
 * else.
 *
 * Auth is stubbed as a signed-in member — the test env is deliberately
 * unconfigured (`editorEnvStub`), so the real provider would never render this
 * panel at all. The film picker is stubbed to one button, because what matters
 * here is what the editor does with a pick rather than how OMDB search behaves.
 */

const auth: Partial<ClubAuthValue> = {
    configured: true,
    status: 'signed-in',
    member: 'Andy',
    admin: false,
    error: null,
    signOut: jest.fn(),
    // Hands the callback a token the way the real provider does.
    withToken: <T,>(call: (token: string) => Promise<T>) => call('token'),
};

jest.mock('../../auth/GoogleAuth', () => ({
    useClubAuth: () => auth,
}));

const putProfile = jest.fn();
const putProfileImage = jest.fn();

jest.mock('../../api/clubApi', () => ({
    putProfile: (...args: unknown[]) => putProfile(...args),
    putProfileImage: (...args: unknown[]) => putProfileImage(...args),
}));

jest.mock('../films/FilmSearchPicker', () => ({
    __esModule: true,
    default: ({ onPick }: { onPick: (hit: { imdbID: string }) => void }) => (
        <button type="button" onClick={() => onPick({ imdbID: 'tt0110912' })}>
            Pick a film
        </button>
    ),
}));

const prepareAvatarUpload = jest.fn();

jest.mock('../../utils/imageUpload', () => ({
    UPLOAD_ACCEPT: 'image/jpeg,image/png,image/webp',
    prepareAvatarUpload: (file: File) => prepareAvatarUpload(file),
}));

const member = makeMember({ name: 'Andy', title: 'Projectionist', bio: 'Watches too much.' });

const renderEditor = (props: Partial<React.ComponentProps<typeof ProfileEditor>> = {}) =>
    render(<ProfileEditor member={member} profileLoading={false} onSaved={jest.fn()} {...props} />);

const open = () => fireEvent.click(screen.getByRole('button', { name: /Edit profile/i }));
const save = () => fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

beforeEach(() => {
    jest.clearAllMocks();
    putProfile.mockResolvedValue({ member, changed: true } satisfies ProfileWriteResult);
});

describe('the profile picture', () => {
    const file = new File(['bytes'], 'me.jpg', { type: 'image/jpeg' });

    const pickFile = () => {
        const input = screen.getByLabelText(/Upload a profile picture/i);
        fireEvent.change(input, { target: { files: [file] } });
    };

    it('uploads the picked file and points the field at what came back', async () => {
        prepareAvatarUpload.mockResolvedValue({
            contentType: 'image/jpeg',
            data: 'AAAA',
            previewUrl: 'data:image/jpeg;base64,AAAA',
            bytes: 3,
        });
        putProfileImage.mockResolvedValue({
            member: { ...member, image: '/images/members/andy-abc.jpg' },
            changed: true,
            image: '/images/members/andy-abc.jpg',
            uploaded: true,
        } satisfies ProfileImageResult);

        const onSaved = jest.fn();
        renderEditor({ onSaved });
        open();
        pickFile();

        await waitFor(() => expect(putProfileImage).toHaveBeenCalled());
        expect(putProfileImage).toHaveBeenCalledWith('token', {
            contentType: 'image/jpeg',
            data: 'AAAA',
        });

        // The field follows the stored path, or the next Save would write the
        // old one straight back over it.
        expect(screen.getByPlaceholderText(/images\/andy\.jpg/i)).toHaveValue(
            '/images/members/andy-abc.jpg'
        );
        expect(onSaved).toHaveBeenCalledWith(
            expect.objectContaining({ image: '/images/members/andy-abc.jpg' })
        );
        expect(screen.getByText(/live on the site in about a minute/i)).toBeInTheDocument();
    });

    it('reports a file it will not send, without calling the worker', async () => {
        prepareAvatarUpload.mockRejectedValue(new Error('That has to be a JPEG, PNG, or WebP.'));

        renderEditor();
        open();
        pickFile();

        await screen.findByText(/has to be a JPEG/i);
        expect(putProfileImage).not.toHaveBeenCalled();
    });
});

describe('the banner art', () => {
    const chooseSelected = () =>
        fireEvent.click(screen.getByRole('radio', { name: /Films you pick/i }));

    it('starts on the top-rated collage every profile has always had', () => {
        renderEditor();
        open();
        expect(screen.getByRole('radio', { name: /Films you rated highest/i })).toBeChecked();
        expect(screen.queryByRole('button', { name: /Pick a film/i })).not.toBeInTheDocument();
    });

    it('saves the films picked, and the mode with them', async () => {
        renderEditor();
        open();
        chooseSelected();
        fireEvent.click(screen.getByRole('button', { name: /Pick a film/i }));
        save();

        await waitFor(() => expect(putProfile).toHaveBeenCalled());
        expect(putProfile).toHaveBeenCalledWith('token', {
            backdropMode: 'selected',
            backdropFilms: ['tt0110912'],
        });
    });

    it('drops a film the member removed again', async () => {
        renderEditor();
        open();
        chooseSelected();
        fireEvent.click(screen.getByRole('button', { name: /Pick a film/i }));
        fireEvent.click(screen.getByRole('button', { name: /Remove .* from your banner/i }));
        save();

        await waitFor(() => expect(putProfile).toHaveBeenCalled());
        // The mode changed, so this is still a save — but the selection ended
        // where it started, and a patch carries only what actually moved.
        expect(putProfile).toHaveBeenCalledWith('token', { backdropMode: 'selected' });
    });

    it('stores no films for a member who picked some and switched back', async () => {
        renderEditor();
        open();
        chooseSelected();
        fireEvent.click(screen.getByRole('button', { name: /Pick a film/i }));
        fireEvent.click(screen.getByRole('radio', { name: /Films you rated highest/i }));
        save();

        // Nothing to save: the mode is back where it started and an unread
        // selection is never stored.
        await screen.findByText(/Nothing to save/i);
        expect(putProfile).not.toHaveBeenCalled();
    });

    it('stops offering the picker once the banner is full', () => {
        renderEditor({
            member: makeMember({
                name: 'Andy',
                backdropMode: 'selected',
                backdropFilms: ['tt0110912', 'tt0068646', 'tt0108052'],
            }),
        });
        open();

        expect(screen.queryByRole('button', { name: /Pick a film/i })).not.toBeInTheDocument();
        expect(screen.getByText(/Remove one to swap it out/i)).toBeInTheDocument();
    });

    it('shows a picked film CI has not caught up with by its id', () => {
        renderEditor({
            member: makeMember({
                name: 'Andy',
                backdropMode: 'selected',
                backdropFilms: ['tt9999999'],
            }),
        });
        open();

        const row = screen.getByRole('listitem');
        expect(within(row).getByText('tt9999999')).toBeInTheDocument();
    });
});
