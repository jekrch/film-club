import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline';

import AccentCard from '../common/AccentCard';
import Button from '../common/Button';
import GoogleSignInButton from '../../auth/GoogleSignInButton';
import { useClubAuth } from '../../auth/GoogleAuth';
import { deleteRating, putRating, type RatingOverride } from '../../api/clubApi';
import type { Film } from '../../types/film';
import {
    BLURB_LIMIT,
    baselineRating,
    buildRatingPatch,
    parseRatingForm,
    toFormValues,
    type RatingFormValues,
} from '../../utils/ratingEditUtils';

/**
 * The signed-in member's own row on a film, made editable (§8.9).
 *
 * Collapsed until asked for, and that matters: expanding it is what mounts the
 * Google sign-in button, so no third-party script runs for someone who is only
 * reading the page.
 *
 * A save commits to the repo and is live after the next Pages build — about a
 * minute. The panel therefore shows the value from its own state with a note
 * saying so, rather than a spinner pretending to wait on something (§8.8): a
 * member who saves an 8, reloads, and sees the old 7 will assume it failed.
 */

interface MyRatingEditorProps {
    film: Film;
    /** The caller's stored override, read live from `main`; absent if they have none. */
    override?: RatingOverride;
    /** True while that read is in flight, so the form doesn't offer stale values. */
    overridesLoading: boolean;
    onSaved: (rating: RatingOverride) => void;
    onReverted: () => void;
}

const FIELD_CLASS =
    'w-full rounded-md border border-slate-600/60 bg-slate-800/60 px-3 py-2 text-slate-100 ' +
    'placeholder:text-slate-500 focus:border-blue-400/60 focus:outline-none';

const MyRatingEditor: React.FC<MyRatingEditorProps> = ({
    film,
    override,
    overridesLoading,
    onSaved,
    onReverted,
}) => {
    const { configured, status, member, signOut, withToken, error: authError } = useClubAuth();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState<RatingFormValues>({ score: '', qualifier: '', blurb: '' });
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [confirmingRevert, setConfirmingRevert] = useState(false);

    const clubRating = useMemo(
        () =>
            member
                ? film.movieClubInfo?.clubRatings.find(
                      (rating) => rating.user.toLowerCase() === member.toLowerCase()
                  )
                : undefined,
        [film, member]
    );

    const baseline = useMemo(() => baselineRating(override, clubRating), [override, clubRating]);
    const baselineForm = useMemo(() => toFormValues(baseline), [baseline]);
    const dirty =
        form.score !== baselineForm.score ||
        form.qualifier !== baselineForm.qualifier ||
        form.blurb !== baselineForm.blurb;

    // The live override arrives after the panel is already open, so the form
    // re-seeds when it lands — unless the member has started typing, whose work
    // must not be thrown away by a late response.
    const dirtyRef = useRef(dirty);
    dirtyRef.current = dirty;
    useEffect(() => {
        if (!dirtyRef.current) setForm(baselineForm);
    }, [baselineForm]);

    if (!configured) return null;

    const update = (field: keyof RatingFormValues, value: string) => {
        setForm((current) => ({ ...current, [field]: value }));
        setNotice(null);
        setSaveError(null);
    };

    const handleSave = async () => {
        const parsed = parseRatingForm(form);
        if ('error' in parsed) {
            setSaveError(parsed.error);
            return;
        }

        const patch = buildRatingPatch(parsed.values, baseline);
        if (Object.keys(patch).length === 0) {
            setNotice('Nothing to save — this already matches what you have.');
            return;
        }

        setSaving(true);
        setSaveError(null);
        setNotice(null);
        try {
            const result = await withToken((token) => putRating(token, film.imdbID, patch));
            onSaved(result.rating);
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

    const handleRevert = async () => {
        setSaving(true);
        setSaveError(null);
        setNotice(null);
        try {
            await withToken((token) => deleteRating(token, film.imdbID));
            onReverted();
            setConfirmingRevert(false);
            setNotice('Reverted — the sheet controls this row again.');
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Revert failed.');
        } finally {
            setSaving(false);
        }
    };

    if (!open) {
        return (
            <div className="mt-6">
                <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => setOpen(true)}
                    className="text-slate-400 hover:text-blue-300"
                >
                    <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
                    Edit my rating
                </Button>
            </div>
        );
    }

    return (
        <AccentCard accent="blue" surface="inset" className="mt-6 p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-3">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-blue-400">
                    {member ? `${member}'s rating` : 'Edit my rating'}
                </h4>
                <span className="h-px flex-grow bg-gradient-to-r from-blue-400/25 via-slate-700/60 to-transparent" />
                <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setOpen(false)}
                    aria-label="Close the rating editor"
                >
                    <XMarkIcon className="h-4 w-4" aria-hidden="true" />
                </Button>
            </div>

            {status !== 'signed-in' ? (
                <div>
                    <p className="mb-3 text-sm text-slate-400">
                        Sign in with the Google account you gave the club to edit your score and
                        review for {film.title}.
                    </p>
                    <GoogleSignInButton />
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex flex-wrap gap-4">
                        <label className="block w-28">
                            <span className="mb-1 block text-xs uppercase tracking-wider text-slate-500">
                                Score
                            </span>
                            <input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                max={10}
                                step={0.1}
                                value={form.score}
                                onChange={(e) => update('score', e.target.value)}
                                disabled={saving || overridesLoading}
                                placeholder="—"
                                className={FIELD_CLASS}
                            />
                        </label>
                        <label className="block w-28">
                            <span className="mb-1 block text-xs uppercase tracking-wider text-slate-500">
                                Qualifier
                            </span>
                            <input
                                type="text"
                                maxLength={1}
                                value={form.qualifier}
                                onChange={(e) => update('qualifier', e.target.value)}
                                disabled={saving || overridesLoading}
                                placeholder="d"
                                className={FIELD_CLASS}
                            />
                        </label>
                        <p className="max-w-xs self-end pb-2 text-xs italic text-slate-500">
                            A qualifier marks a score given on a different rubric — "d" for a
                            documentary. Leave it blank otherwise.
                        </p>
                    </div>

                    <label className="block">
                        <span className="mb-1 block text-xs uppercase tracking-wider text-slate-500">
                            Review
                        </span>
                        <textarea
                            rows={4}
                            maxLength={BLURB_LIMIT}
                            value={form.blurb}
                            onChange={(e) => update('blurb', e.target.value)}
                            disabled={saving || overridesLoading}
                            placeholder="What did you make of it? Markdown works here."
                            className={FIELD_CLASS}
                        />
                    </label>

                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            type="button"
                            variant="solid"
                            size="sm"
                            accent="blue"
                            onClick={() => void handleSave()}
                            disabled={saving || overridesLoading || !dirty}
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

                        {/* Revert exists only where there is an override to
                            remove: it hands the row back to the sheet, which is
                            meaningless for a row the sheet still owns. */}
                        {override && !confirmingRevert && (
                            <Button
                                type="button"
                                variant="link"
                                size="sm"
                                accent="rose"
                                onClick={() => setConfirmingRevert(true)}
                                disabled={saving}
                                className="ml-auto"
                            >
                                Revert to the sheet
                            </Button>
                        )}
                        {override && confirmingRevert && (
                            <span className="ml-auto flex items-center gap-3 text-sm text-slate-400">
                                Drop your edits and use the sheet's value?
                                <Button
                                    type="button"
                                    variant="link"
                                    size="sm"
                                    accent="rose"
                                    onClick={() => void handleRevert()}
                                    disabled={saving}
                                >
                                    Revert
                                </Button>
                                <Button
                                    type="button"
                                    variant="link"
                                    size="sm"
                                    onClick={() => setConfirmingRevert(false)}
                                    className="text-slate-400 hover:text-slate-200"
                                >
                                    Cancel
                                </Button>
                            </span>
                        )}
                    </div>

                    {notice && <p className="text-sm text-emerald-300">{notice}</p>}
                    {saveError && <p className="text-sm text-rose-300">{saveError}</p>}
                    {authError && !saveError && <p className="text-sm text-rose-300">{authError}</p>}

                    <p className="border-t border-slate-700/60 pt-3 text-xs text-slate-500">
                        Signed in as {member}.{' '}
                        <Button
                            type="button"
                            variant="link"
                            size="xs"
                            onClick={signOut}
                            className="text-slate-400 hover:text-slate-200"
                        >
                            Sign out
                        </Button>
                    </p>
                </div>
            )}
        </AccentCard>
    );
};

export default MyRatingEditor;
