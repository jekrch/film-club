import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline';

import AccentCard from '../common/AccentCard';
import Button from '../common/Button';
import Select from '../common/Select';
import { useClubAuth } from '../../auth/GoogleAuth';
import { deleteRating, putRating, type RatingOverride } from '../../api/clubApi';
import type { Film } from '../../types/film';
import { teamMembers } from '../../types/team';
import {
    BLURB_LIMIT,
    MAX_SCORE,
    SCORE_STEP,
    baselineRating,
    buildRatingPatch,
    parseRatingForm,
    sameFormValues,
    toFormValues,
    type RatingFormValues,
} from '../../utils/ratingEditUtils';

/**
 * The signed-in member's own row on a film, made editable (§8.9) — and, for an
 * admin, anyone else's.
 *
 * Rendered only for a signed-in member, and collapsed until asked for: someone
 * reading the page is never offered an editor, and never told how to sign in —
 * the nav's account control is the one place that happens.
 *
 * The member picker appears for admins only, and exists because the club enters
 * an evening's scores together: five people say a number, one person types them
 * in. That used to be a row of the Google Sheet. Everyone else sees exactly what
 * they saw before — their own row, no picker — and the worker enforces the same
 * rule again on the way in.
 *
 * A save commits to the repo and is live after the next Pages build — about a
 * minute. The panel therefore shows the value from its own state with a note
 * saying so, rather than a spinner pretending to wait on something (§8.8): a
 * member who saves an 8, reloads, and sees the old 7 will assume it failed.
 */

interface MyRatingEditorProps {
    film: Film;
    /**
     * The film's stored overrides, keyed by lowercased member name and read live
     * from `main`. The whole map rather than one row, because an admin can move
     * the picker to a member whose override the parent would have to guess at.
     */
    ratings?: Record<string, RatingOverride>;
    /** True while that read is in flight, so the form doesn't offer stale values. */
    overridesLoading: boolean;
    onSaved: (owner: string, rating: RatingOverride) => void;
    onReverted: (owner: string) => void;
}

const FIELD_CLASS =
    'w-full rounded-md border border-slate-600/60 bg-slate-800/60 px-3 py-2 text-slate-100 ' +
    'placeholder:text-slate-500 focus:border-blue-400/60 focus:outline-none';

/**
 * The review is the one field here anyone writes a paragraph into — the limit
 * is 4000 characters — so it opens tall enough to hold one and drags taller
 * from there. A four-line box makes the field read like a caption.
 */
const REVIEW_CLASS = `${FIELD_CLASS} min-h-56 resize-y leading-relaxed`;

const MyRatingEditor: React.FC<MyRatingEditorProps> = ({
    film,
    ratings,
    overridesLoading,
    onSaved,
    onReverted,
}) => {
    const {
        configured,
        status,
        member,
        admin,
        signOut,
        withToken,
        error: authError,
    } = useClubAuth();
    const [open, setOpen] = useState(false);
    /**
     * Whose row the form is showing. Always the caller for a non-admin — the
     * picker that changes it is not rendered — and the caller by default for an
     * admin, since editing your own rating is still the common case.
     */
    const [editing, setEditing] = useState<string | null>(null);
    const [form, setForm] = useState<RatingFormValues>({ score: '', qualifier: '', blurb: '' });
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [confirmingRevert, setConfirmingRevert] = useState(false);

    // A non-admin's `editing` is ignored entirely rather than merely unset, so
    // no stale selection can outlive a sign-out and a sign-in as someone else.
    const owner = (admin ? (editing ?? member) : member) ?? null;
    const isSelf = owner !== null && owner.toLowerCase() === (member ?? '').toLowerCase();

    const override = useMemo(
        () => (owner ? ratings?.[owner.toLowerCase()] : undefined),
        [ratings, owner]
    );

    const clubRating = useMemo(
        () =>
            owner
                ? film.movieClubInfo?.clubRatings.find(
                      (rating) => rating.user.toLowerCase() === owner.toLowerCase()
                  )
                : undefined,
        [film, owner]
    );

    const baseline = useMemo(() => baselineRating(override, clubRating), [override, clubRating]);
    const baselineForm = useMemo(() => toFormValues(baseline), [baseline]);
    const dirty = !sameFormValues(form, baselineForm);

    // The member's own rating arrives after the panel is already open — the
    // sign-in resolves, then the live override lands — so the form re-seeds each
    // time the baseline moves, unless the member has started typing, whose work
    // must not be thrown away by a late response.
    //
    // "Has started typing" is measured against the values last seeded, not
    // against the incoming baseline: the two differ precisely when the baseline
    // has just changed, so comparing with the new one reads the arrival itself
    // as member input and leaves the form stuck on its empty initial values.
    const formRef = useRef(form);
    formRef.current = form;
    const seededRef = useRef<{ owner: string | null; values: RatingFormValues } | null>(null);
    useEffect(() => {
        const current = formRef.current;
        const seeded = seededRef.current;

        // Moving the picker to another member discards the form outright.
        // What is in it is the previous member's rating, and carrying it over
        // is the one mistake this panel must not make — it would write Andy's
        // 9 onto Gabe's row and look like a successful save.
        const switched = seeded !== null && seeded.owner !== owner;
        const typedIn = !switched && seeded !== null && !sameFormValues(current, seeded.values);
        // Reaching the new baseline by hand counts as untouched: there is
        // nothing of the member's to protect, and the seed stays in step.
        if (typedIn && !sameFormValues(current, baselineForm)) return;

        seededRef.current = { owner, values: baselineForm };
        if (!sameFormValues(current, baselineForm)) setForm(baselineForm);
    }, [baselineForm, owner]);

    if (!configured || status !== 'signed-in') return null;

    const memberOptions = teamMembers
        .filter((entry) => entry.name)
        .map((entry) => ({ value: entry.name, label: entry.name }));

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
            setNotice(
                isSelf
                    ? 'Nothing to save — this already matches what you have.'
                    : `Nothing to save — this already matches ${owner}'s row.`
            );
            return;
        }

        setSaving(true);
        setSaveError(null);
        setNotice(null);
        try {
            const result = await withToken((token) =>
                // `owner` is sent only when it isn't the caller: the worker
                // defaults to the token's member, and an admin editing their
                // own row should take the same path everyone else does.
                putRating(token, film.imdbID, isSelf ? patch : { ...patch, owner: owner ?? '' })
            );
            onSaved(result.owner, result.rating);
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
            await withToken((token) =>
                deleteRating(token, film.imdbID, isSelf ? undefined : (owner ?? undefined))
            );
            onReverted(owner ?? '');
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
                    {owner ? `${owner}'s rating` : 'Edit my rating'}
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

            <div className="space-y-4">
                {/* Admins only. Everyone else edits one row — their own — and a
                    control offering otherwise would be a 403 waiting to happen. */}
                {admin && (
                    <div className="flex flex-wrap items-end gap-4">
                        <Select
                            label="Whose rating"
                            value={owner ?? ''}
                            onChange={(value) => {
                                setEditing(value === '' ? null : value);
                                setConfirmingRevert(false);
                                setNotice(null);
                                setSaveError(null);
                            }}
                            options={memberOptions}
                            placeholder={member ?? 'Pick a member'}
                            className="w-44"
                        />
                        {!isSelf && (
                            <p className="max-w-xs self-end pb-2 text-xs italic text-slate-500">
                                You're editing {owner}'s row. It is recorded as theirs, with you as
                                the last person to touch it.
                            </p>
                        )}
                    </div>
                )}

                <div className="flex flex-wrap gap-4">
                    <label className="block w-28">
                        <span className="mb-1 block text-xs uppercase tracking-wider text-slate-500">
                            Score / {MAX_SCORE}
                        </span>
                        <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={MAX_SCORE}
                            step={SCORE_STEP}
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
                        rows={10}
                        maxLength={BLURB_LIMIT}
                        value={form.blurb}
                        onChange={(e) => update('blurb', e.target.value)}
                        disabled={saving || overridesLoading}
                        placeholder="What did you make of it? Markdown works here."
                        className={REVIEW_CLASS}
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
                            {isSelf
                                ? "Drop your edits and use the sheet's value?"
                                : `Drop ${owner}'s edits and use the sheet's value?`}
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
        </AccentCard>
    );
};

export default MyRatingEditor;
