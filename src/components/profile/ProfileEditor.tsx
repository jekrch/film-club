import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { putProfile } from '../../api/clubApi';
import { useClubAuth } from '../../auth/GoogleAuth';
import type { TeamMember } from '../../types/team';
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
 * bio, their link, and their interview (§8.9).
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

const ProfileEditor: React.FC<ProfileEditorProps> = ({ member, profileLoading, onSaved }) => {
    const { member: signedInAs, withToken } = useClubAuth();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState<ProfileFormValues>(() =>
        toProfileForm(toProfileValues(member))
    );
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

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

        // An admin editing someone else's profile has to name them; for anyone
        // editing their own, the worker uses the caller and this is left off.
        const owner =
            signedInAs && signedInAs.toLowerCase() !== member.name.toLowerCase()
                ? member.name
                : undefined;

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

    const busy = saving || profileLoading;

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
                            square thumb would hide a badly cropped portrait. */}
                        <ImageUrlPreview url={form.image} className="h-11 w-11 rounded-full" />
                    </div>
                </label>

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
