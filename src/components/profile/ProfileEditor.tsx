import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowUpTrayIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    PencilSquareIcon,
    PlusIcon,
    TrashIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';

import AccentCard from '../common/AccentCard';
import Button from '../common/Button';
import ImageUrlPreview from '../common/ImageUrlPreview';
import FilmSearchPicker from '../films/FilmSearchPicker';
import { putProfile, putProfileImage } from '../../api/clubApi';
import { useClubAuth } from '../../auth/GoogleAuth';
import type { BackdropMode, TeamMember } from '../../types/team';
import { UPLOAD_ACCEPT, prepareAvatarUpload } from '../../utils/imageUpload';
import { BACKDROP_FILM_LIMIT, resolveBackdropFilm } from '../../utils/profileBackdrop';
import {
    ANSWER_LIMIT,
    BIO_LIMIT,
    INTERVIEW_LIMIT,
    QUESTION_LIMIT,
    TITLE_LIMIT,
    buildProfilePatch,
    newInterviewRow,
    parseProfileForm,
    sameProfileForm,
    toProfileForm,
    toProfileValues,
    type ProfileFormValues,
} from '../../utils/profileEditUtils';

/**
 * A member's own profile, made editable: their picture, their role line, their
 * bio, their link, their interview (§8.9), and what their banner draws.
 *
 * Two of those don't behave like the rest, and both for the same reason — they
 * aren't text. A picture may be *uploaded* rather than linked, which commits the
 * file and the profile immediately instead of waiting for Save; there is no
 * half-typed state for a file, and holding bytes in form state until a later
 * click would only invent one. Banner films are picked from search rather than
 * typed, but are ordinary form state and save with everything else.
 *
 * Collapsed until asked for, like every other editor here — though for a
 * gentler reason than the rest. This one is only rendered for someone already
 * signed in and entitled to edit it, so no third-party script hangs on the
 * toggle; what it protects is the profile page, which is a thing to read rather
 * than a form to fill in.
 *
 * A save commits to the repo and is live after the next Pages build — about a
 * minute — so the page renders from what came back rather than waiting (§8.8).
 * What it can't do is change who someone is: `name` is the key every rating,
 * list, and watch log joins on, and the worker refuses it.
 */

interface ProfileEditorProps {
    /** The member as the page has them — the live record if it loaded, else the bundle's. */
    member: TeamMember;
    /** True while the live read is in flight, so the form doesn't seed a stale bio. */
    profileLoading: boolean;
    /** Hands the stored record back to the page, which re-renders from it. */
    onSaved: (member: TeamMember) => void;
}

const FIELD_CLASS =
    'w-full rounded-md border border-slate-600/60 bg-slate-800/60 px-3 py-2 text-slate-100 ' +
    'placeholder:text-slate-500 focus:border-blue-400/60 focus:outline-none';

const LABEL_CLASS = 'mb-1 block text-xs uppercase tracking-wider text-slate-500';

/**
 * The two things a banner can draw, in the words a member would use for them.
 *
 * "Top-rated" is described by what it *does* rather than named, because it is
 * the behavior everyone already has and nobody has ever had to think about — the
 * choice only makes sense if the default is spelled out next to the alternative.
 */
const BACKDROP_CHOICES: { mode: BackdropMode; label: string; hint: string }[] = [
    {
        mode: 'top-rated',
        label: 'Films you rated highest',
        hint: 'A different cut of your best-scored club films on every visit.',
    },
    {
        mode: 'selected',
        label: 'Films you pick',
        // Not "in order": the collage shuffles its panels and picks a different
        // still on every load, for a selection exactly as for the default.
        hint: `Up to ${BACKDROP_FILM_LIMIT} films, club or not — their artwork fills the banner.`,
    },
];

const ProfileEditor: React.FC<ProfileEditorProps> = ({ member, profileLoading, onSaved }) => {
    const { member: signedInAs, withToken } = useClubAuth();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState<ProfileFormValues>(() =>
        toProfileForm(toProfileValues(member))
    );
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    /**
     * The uploaded image as a `data:` URL, so the thumbnail shows what was just
     * sent. The committed file isn't served until the next Pages build finishes,
     * so previewing the stored path instead would show a broken image for the
     * minute that follows an upload — the one moment it most needs to look like
     * it worked.
     */
    const [uploadPreview, setUploadPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const baseline = useMemo(() => toProfileValues(member), [member]);
    const baselineForm = useMemo(() => toProfileForm(baseline), [baseline]);
    const dirty = !sameProfileForm(form, baselineForm);

    // The live record lands after the panel is already open, so the form
    // re-seeds when the baseline moves — unless the member has started typing,
    // whose work a late response must not throw away. "Started typing" is
    // measured against what was last seeded rather than against the incoming
    // baseline, which is the same reasoning `MyRatingEditor` sets out at length.
    const formRef = useRef(form);
    formRef.current = form;
    const seededRef = useRef<ProfileFormValues | null>(null);
    useEffect(() => {
        const current = formRef.current;
        const seeded = seededRef.current;
        const typedIn = seeded !== null && !sameProfileForm(current, seeded);
        if (typedIn && !sameProfileForm(current, baselineForm)) return;

        seededRef.current = baselineForm;
        if (!sameProfileForm(current, baselineForm)) setForm(baselineForm);
    }, [baselineForm]);

    const update = (field: 'title' | 'bio' | 'url' | 'image', value: string) => {
        setForm((current) => ({ ...current, [field]: value }));
        // A typed path is a different picture from the uploaded one, so the
        // thumbnail goes back to following the field.
        if (field === 'image') setUploadPreview(null);
        setNotice(null);
        setSaveError(null);
    };

    const setBackdropMode = (backdropMode: BackdropMode) => {
        setForm((current) => ({ ...current, backdropMode }));
        setNotice(null);
        setSaveError(null);
    };

    const addBackdropFilm = (imdbID: string) => {
        setForm((current) =>
            current.backdropFilms.includes(imdbID) ||
            current.backdropFilms.length >= BACKDROP_FILM_LIMIT
                ? current
                : { ...current, backdropFilms: [...current.backdropFilms, imdbID] }
        );
        setNotice(null);
        setSaveError(null);
    };

    const removeBackdropFilm = (imdbID: string) => {
        setForm((current) => ({
            ...current,
            backdropFilms: current.backdropFilms.filter((id) => id !== imdbID),
        }));
        setNotice(null);
        setSaveError(null);
    };

    const updateRow = (id: string, field: 'question' | 'answer', value: string) => {
        setForm((current) => ({
            ...current,
            interview: current.interview.map((row) =>
                row.id === id ? { ...row, [field]: value } : row
            ),
        }));
        setNotice(null);
        setSaveError(null);
    };

    const addRow = () => {
        setForm((current) => ({
            ...current,
            interview: [...current.interview, newInterviewRow()],
        }));
        setNotice(null);
        setSaveError(null);
    };

    const removeRow = (id: string) => {
        setForm((current) => ({
            ...current,
            interview: current.interview.filter((row) => row.id !== id),
        }));
        setNotice(null);
        setSaveError(null);
    };

    /** Moves a question one place up or down; the interview reads in order. */
    const moveRow = (index: number, delta: -1 | 1) => {
        setForm((current) => {
            const target = index + delta;
            if (target < 0 || target >= current.interview.length) return current;
            const interview = [...current.interview];
            [interview[index], interview[target]] = [interview[target], interview[index]];
            return { ...current, interview };
        });
        setNotice(null);
        setSaveError(null);
    };

    // An admin editing someone else's profile has to name them; for anyone
    // editing their own, the worker uses the caller and this is left off.
    const owner =
        signedInAs && signedInAs.toLowerCase() !== member.name.toLowerCase()
            ? member.name
            : undefined;

    /**
     * Resizes the picked file and commits it, in one action.
     *
     * Unlike every other field here this doesn't wait for Save, and the reason is
     * that a file has no half-typed state to protect: the member has chosen a
     * picture or they haven't. Holding the bytes in form state until a later
     * click would mean a Discard that silently throws away an upload, and a Save
     * button whose meaning depends on which field was touched.
     *
     * The saved record comes back and goes to the page, so the baseline moves
     * with it — and `form.image` is set to match, or the very next Save would
     * dutifully write the old path back over the new one.
     */
    const handleUpload = async (file: File) => {
        setUploading(true);
        setSaveError(null);
        setNotice(null);
        try {
            const prepared = await prepareAvatarUpload(file);
            const result = await withToken((token) =>
                putProfileImage(token, {
                    contentType: prepared.contentType,
                    data: prepared.data,
                    ...(owner ? { owner } : {}),
                })
            );

            setUploadPreview(prepared.previewUrl);
            setForm((current) => ({ ...current, image: result.image }));
            onSaved(result.member);
            setNotice(
                result.changed
                    ? 'Picture uploaded — live on the site in about a minute.'
                    : 'That was already your picture; nothing changed.'
            );
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Upload failed.');
        } finally {
            setUploading(false);
            // Cleared so picking the same file again still fires a change event,
            // which matters after a failed upload more than a successful one.
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleSave = async () => {
        const parsed = parseProfileForm(form);
        if ('error' in parsed) {
            setSaveError(parsed.error);
            return;
        }

        const patch = buildProfilePatch(parsed.values, baseline);
        if (Object.keys(patch).length === 0) {
            setNotice('Nothing to save — this already matches your profile.');
            return;
        }

        setSaving(true);
        setSaveError(null);
        setNotice(null);
        try {
            const result = await withToken((token) =>
                putProfile(token, owner ? { ...patch, owner } : patch)
            );
            onSaved(result.member);
            setNotice(
                result.changed
                    ? 'Saved — live on the site in about a minute.'
                    : 'Already saved; nothing changed.'
            );
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Save failed.');
        } finally {
            setSaving(false);
        }
    };

    if (!open) {
        return (
            <div className="mb-8 -mt-4 flex justify-end">
                <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => setOpen(true)}
                    className="text-slate-400 hover:text-blue-300"
                >
                    <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
                    Edit profile
                </Button>
            </div>
        );
    }

    const busy = saving || uploading || profileLoading;

    return (
        <AccentCard accent="blue" className="mb-8 p-6 md:p-10">
            <div className="mb-6 flex items-center gap-3">
                <h4 className="text-xl font-bold text-slate-100">
                    {signedInAs?.toLowerCase() === member.name.toLowerCase()
                        ? 'Your profile'
                        : `${member.name}'s profile`}
                </h4>
                <span className="h-px flex-grow bg-gradient-to-r from-blue-400/25 via-slate-700/60 to-transparent" />
                <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setOpen(false)}
                    aria-label="Close the profile editor"
                >
                    <XMarkIcon className="h-4 w-4" aria-hidden="true" />
                </Button>
            </div>

            <div className="space-y-5">
                <div>
                    <label className="block">
                        <span className={LABEL_CLASS}>Profile picture</span>
                        <div className="flex items-center gap-3">
                            <input
                                type="text"
                                value={form.image}
                                onChange={(e) => update('image', e.target.value)}
                                disabled={busy}
                                placeholder="/images/andy.jpg or https://…"
                                className={FIELD_CLASS}
                            />
                            {/* Round, because that is the shape it lands in — a
                                square thumb would hide a badly cropped portrait.
                                Shows the uploaded image itself while the file it
                                was committed to is still being deployed. */}
                            <ImageUrlPreview
                                url={uploadPreview ?? form.image}
                                className="h-11 w-11 rounded-full"
                            />
                        </div>
                    </label>

                    {/* The other way to fill that field, for the members — most
                        of them — with a photograph on their phone rather than a
                        URL to one. The input itself is hidden because a bare
                        file input can't be styled and reads as a stray control
                        next to the rest of the form. */}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept={UPLOAD_ACCEPT}
                            className="sr-only"
                            aria-label="Upload a profile picture"
                            disabled={busy}
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) void handleUpload(file);
                            }}
                        />
                        <Button
                            type="button"
                            variant="link"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={busy}
                            className="text-blue-400 hover:text-blue-300"
                        >
                            <ArrowUpTrayIcon className="h-4 w-4" aria-hidden="true" />
                            {uploading ? 'Uploading…' : 'Upload a picture'}
                        </Button>
                        <span className="text-xs text-slate-500">
                            JPEG, PNG, or WebP. Saved as soon as it uploads.
                        </span>
                    </div>
                </div>

                <label className="block">
                    <span className={LABEL_CLASS}>Title</span>
                    <input
                        type="text"
                        maxLength={TITLE_LIMIT}
                        value={form.title}
                        onChange={(e) => update('title', e.target.value)}
                        disabled={busy}
                        placeholder="Filmmaker & Director"
                        className={FIELD_CLASS}
                    />
                </label>

                <label className="block">
                    <span className={LABEL_CLASS}>Bio</span>
                    <textarea
                        rows={5}
                        maxLength={BIO_LIMIT}
                        value={form.bio}
                        onChange={(e) => update('bio', e.target.value)}
                        disabled={busy}
                        placeholder="A line or two about you. Markdown works here."
                        className={FIELD_CLASS}
                    />
                </label>

                <label className="block">
                    <span className={LABEL_CLASS}>Link</span>
                    <input
                        type="url"
                        value={form.url}
                        onChange={(e) => update('url', e.target.value)}
                        disabled={busy}
                        placeholder="https://letterboxd.com/…"
                        className={FIELD_CLASS}
                    />
                </label>

                {/* What the collage behind the name and bio at the top of this
                    page draws from. */}
                <div className="border-t border-slate-700/60 pt-5">
                    <div className="mb-3 flex items-center gap-3">
                        <h5 className="text-sm font-semibold uppercase tracking-wider text-blue-400">
                            Banner art
                        </h5>
                        <span className="h-px flex-grow bg-slate-700/60" />
                    </div>

                    <div className="space-y-2">
                        {BACKDROP_CHOICES.map((choice) => (
                            <label
                                key={choice.mode}
                                className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-600/30 bg-slate-700/25 p-3 transition-colors hover:border-blue-500/25 hover:bg-slate-700/40"
                            >
                                <input
                                    type="radio"
                                    name="backdrop-mode"
                                    value={choice.mode}
                                    checked={form.backdropMode === choice.mode}
                                    onChange={() => setBackdropMode(choice.mode)}
                                    disabled={busy}
                                    className="mt-1 accent-blue-500"
                                />
                                <span className="min-w-0">
                                    <span className="block text-sm text-slate-200">
                                        {choice.label}
                                    </span>
                                    <span className="block text-xs text-slate-500">
                                        {choice.hint}
                                    </span>
                                </span>
                            </label>
                        ))}
                    </div>

                    {form.backdropMode === 'selected' && (
                        <div className="mt-4 space-y-3">
                            {form.backdropFilms.length === 0 && (
                                <p className="text-sm italic text-slate-500">
                                    No films picked yet — the banner shows your top-rated ones until
                                    you add one.
                                </p>
                            )}

                            <ul className="space-y-2">
                                {form.backdropFilms.map((imdbID) => {
                                    const film = resolveBackdropFilm(imdbID);
                                    return (
                                        <li
                                            key={imdbID}
                                            className="flex items-center gap-3 rounded-xl border border-slate-600/30 bg-slate-700/25 px-3 py-2"
                                        >
                                            {film.poster ? (
                                                <img
                                                    src={film.poster}
                                                    alt=""
                                                    loading="lazy"
                                                    className="h-12 w-8 flex-shrink-0 rounded object-cover object-top"
                                                    onError={(e) => {
                                                        e.currentTarget.style.visibility = 'hidden';
                                                    }}
                                                />
                                            ) : (
                                                <span className="h-12 w-8 flex-shrink-0 rounded bg-slate-800" />
                                            )}
                                            <span className="min-w-0 flex-grow truncate text-slate-200">
                                                {/* An id CI hasn't caught up with
                                                    yet has no title to show; it
                                                    is still the film they picked,
                                                    so it says so rather than
                                                    disappearing. */}
                                                {film.title ?? imdbID}
                                                {film.year && (
                                                    <span className="ml-1.5 text-slate-500">
                                                        {film.year}
                                                    </span>
                                                )}
                                            </span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="xs"
                                                onClick={() => removeBackdropFilm(imdbID)}
                                                disabled={busy}
                                                aria-label={`Remove ${film.title ?? imdbID} from your banner`}
                                                className="hover:text-rose-300"
                                            >
                                                <TrashIcon className="h-4 w-4" aria-hidden="true" />
                                            </Button>
                                        </li>
                                    );
                                })}
                            </ul>

                            {form.backdropFilms.length < BACKDROP_FILM_LIMIT ? (
                                <FilmSearchPicker
                                    onPick={(hit) => addBackdropFilm(hit.imdbID)}
                                    chosen={new Set(form.backdropFilms)}
                                    label="Add a film to your banner"
                                    chosenLabel="added"
                                    accent="blue"
                                />
                            ) : (
                                <p className="text-xs text-slate-500">
                                    That's all {BACKDROP_FILM_LIMIT} panels. Remove one to swap it
                                    out.
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <div className="border-t border-slate-700/60 pt-5">
                    <div className="mb-3 flex items-center gap-3">
                        <h5 className="text-sm font-semibold uppercase tracking-wider text-blue-400">
                            Interview
                        </h5>
                        <span className="h-px flex-grow bg-slate-700/60" />
                        <span className="text-xs text-slate-500">
                            {form.interview.length} question
                            {form.interview.length === 1 ? '' : 's'}
                        </span>
                    </div>

                    {form.interview.length === 0 && (
                        <p className="py-2 text-sm italic text-slate-500">
                            No questions yet. The interview renders on your profile in the order you
                            put them in.
                        </p>
                    )}

                    <div className="space-y-4">
                        {form.interview.map((row, index) => (
                            <div
                                key={row.id}
                                className="rounded-xl border border-slate-600/30 bg-slate-700/25 p-4"
                            >
                                <div className="mb-2 flex items-center gap-2">
                                    <input
                                        type="text"
                                        maxLength={QUESTION_LIMIT}
                                        value={row.question}
                                        onChange={(e) =>
                                            updateRow(row.id, 'question', e.target.value)
                                        }
                                        disabled={busy}
                                        placeholder="The question"
                                        aria-label={`Question ${index + 1}`}
                                        className={FIELD_CLASS}
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="xs"
                                        onClick={() => moveRow(index, -1)}
                                        disabled={busy || index === 0}
                                        aria-label={`Move question ${index + 1} up`}
                                    >
                                        <ChevronUpIcon className="h-4 w-4" aria-hidden="true" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="xs"
                                        onClick={() => moveRow(index, 1)}
                                        disabled={busy || index === form.interview.length - 1}
                                        aria-label={`Move question ${index + 1} down`}
                                    >
                                        <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="xs"
                                        onClick={() => removeRow(row.id)}
                                        disabled={busy}
                                        aria-label={`Remove question ${index + 1}`}
                                        className="hover:text-rose-300"
                                    >
                                        <TrashIcon className="h-4 w-4" aria-hidden="true" />
                                    </Button>
                                </div>
                                <textarea
                                    rows={3}
                                    maxLength={ANSWER_LIMIT}
                                    value={row.answer}
                                    onChange={(e) => updateRow(row.id, 'answer', e.target.value)}
                                    disabled={busy}
                                    placeholder="The answer. Markdown works here."
                                    aria-label={`Answer ${index + 1}`}
                                    className={FIELD_CLASS}
                                />
                            </div>
                        ))}
                    </div>

                    {form.interview.length < INTERVIEW_LIMIT && (
                        <Button
                            type="button"
                            variant="link"
                            size="sm"
                            onClick={addRow}
                            disabled={busy}
                            className="mt-3 text-blue-400 hover:text-blue-300"
                        >
                            <PlusIcon className="h-4 w-4" aria-hidden="true" />
                            Add a question
                        </Button>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-3 border-t border-slate-700/60 pt-5">
                    <Button
                        type="button"
                        variant="solid"
                        size="sm"
                        accent="blue"
                        onClick={() => void handleSave()}
                        disabled={busy || !dirty}
                    >
                        {saving ? 'Saving…' : 'Save'}
                    </Button>

                    {dirty && !saving && (
                        <Button
                            type="button"
                            variant="link"
                            size="sm"
                            onClick={() => {
                                setForm(baselineForm);
                                setSaveError(null);
                                setNotice(null);
                            }}
                            className="text-slate-400 hover:text-slate-200"
                        >
                            Discard changes
                        </Button>
                    )}
                </div>

                {notice && <p className="text-sm text-emerald-300">{notice}</p>}
                {saveError && <p className="text-sm text-rose-300">{saveError}</p>}
            </div>
        </AccentCard>
    );
};

export default ProfileEditor;
