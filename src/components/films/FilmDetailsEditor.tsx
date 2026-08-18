import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FilmIcon, PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline';

import AccentCard from '../common/AccentCard';
import Button from '../common/Button';
import FilmClubFields from './FilmClubFields';
import { useClubAuth } from '../../auth/GoogleAuth';
import { deleteFilm, putFilm, type FilmOverride, type FilmSubmission } from '../../api/clubApi';
import type { Film } from '../../types/film';
import {
    EMPTY_FILM_FORM,
    baselineFilmForm,
    buildFilmPatch,
    parseFilmForm,
    sameFilmForm,
    type FilmFormValues,
} from '../../utils/filmEditUtils';

/**
 * The film's own club record, made editable in place: whose pick it was, when
 * the club watched it, and the two images the site cannot source for itself.
 *
 * These four fields were the Google Sheet's job — two of its columns and two
 * hand-edits to `films.json` — which made adding a film to the club a
 * spreadsheet errand and correcting a wrong cover a commit. They are club
 * property rather than anyone's own row, so any signed-in member may write them,
 * on the same reasoning that lets any member hand out a trophy.
 *
 * Rendered only for a signed-in member and collapsed until asked for, like every
 * other editor here. A save commits to the repo and is live after the next Pages
 * build — about a minute — so the panel reports what it stored rather than
 * waiting for the page around it to agree (§8.8).
 */

interface FilmDetailsEditorProps {
    film: Film;
    /** The stored club record, read live from `main`; absent when nobody has set one. */
    override?: FilmOverride;
    /** Present when this film was added on the site rather than through the sheet. */
    added?: FilmSubmission;
    /** True while that read is in flight, so the form doesn't offer stale values. */
    loading: boolean;
    onSaved: (record: { film?: FilmOverride; added?: FilmSubmission }) => void;
    onReverted: () => void;
}

const FilmDetailsEditor: React.FC<FilmDetailsEditorProps> = ({
    film,
    override,
    added,
    loading,
    onSaved,
    onReverted,
}) => {
    const { configured, status, member, withToken, error: authError } = useClubAuth();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState<FilmFormValues>(EMPTY_FILM_FORM);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [confirmingRevert, setConfirmingRevert] = useState(false);

    const baseline = useMemo(() => baselineFilmForm(film, override), [film, override]);
    const dirty = !sameFilmForm(form, baseline);

    // The stored record arrives after the panel is already open — the sign-in
    // resolves, then the live read lands — so the form re-seeds each time the
    // baseline moves, unless the member has started typing. Measured against
    // the values last seeded rather than the incoming ones, for the reason
    // spelled out at the same point in `MyRatingEditor`.
    const formRef = useRef(form);
    formRef.current = form;
    const seededRef = useRef<FilmFormValues | null>(null);
    useEffect(() => {
        const current = formRef.current;
        const seeded = seededRef.current;
        const typedIn = seeded !== null && !sameFilmForm(current, seeded);
        if (typedIn && !sameFilmForm(current, baseline)) return;

        seededRef.current = baseline;
        if (!sameFilmForm(current, baseline)) setForm(baseline);
    }, [baseline]);

    if (!configured || status !== 'signed-in') return null;

    const update = (field: keyof FilmFormValues, value: string) => {
        setForm((current) => ({ ...current, [field]: value }));
        setNotice(null);
        setSaveError(null);
    };

    const handleSave = async () => {
        const parsed = parseFilmForm(form);
        if ('error' in parsed) {
            setSaveError(parsed.error);
            return;
        }

        const patch = buildFilmPatch(parsed.values, baseline);
        if (Object.keys(patch).length === 0) {
            setNotice('Nothing to save — this already matches what the film says.');
            return;
        }

        setSaving(true);
        setSaveError(null);
        setNotice(null);
        try {
            const result = await withToken((token) => putFilm(token, film.imdbID, patch));
            onSaved({ film: result.film, added: result.added });
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
            const result = await withToken((token) => deleteFilm(token, film.imdbID));
            onReverted();
            setConfirmingRevert(false);
            setNotice(
                result.withdrawn
                    ? "Withdrawn — the film won't be added."
                    : 'Reverted — the sheet controls these fields again.'
            );
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
                    Edit film details
                </Button>
            </div>
        );
    }

    return (
        <AccentCard accent="blue" surface="inset" className="mt-6 p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-3">
                <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-blue-400">
                    <FilmIcon className="h-4 w-4" aria-hidden="true" />
                    Film details
                </h4>
                <span className="h-px flex-grow bg-gradient-to-r from-blue-400/25 via-slate-700/60 to-transparent" />
                <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setOpen(false)}
                    aria-label="Close the film details editor"
                >
                    <XMarkIcon className="h-4 w-4" aria-hidden="true" />
                </Button>
            </div>

            <FilmClubFields values={form} onChange={update} disabled={saving || loading} />

            <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button
                    type="button"
                    variant="solid"
                    size="sm"
                    accent="blue"
                    onClick={() => void handleSave()}
                    disabled={saving || loading || !dirty}
                >
                    {saving ? 'Saving…' : 'Save'}
                </Button>

                {dirty && !saving && (
                    <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() => {
                            setForm(baseline);
                            setSaveError(null);
                            setNotice(null);
                        }}
                        className="text-slate-400 hover:text-slate-200"
                    >
                        Discard changes
                    </Button>
                )}

                {/* Reverting is only meaningful where there is something to
                    revert *to*: these fields belong to the sheet until a member
                    overrides one. */}
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
                        Drop these edits and use the sheet's values?
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

            {notice && <p className="mt-3 text-sm text-emerald-300">{notice}</p>}
            {saveError && <p className="mt-3 text-sm text-rose-300">{saveError}</p>}
            {authError && !saveError && <p className="mt-3 text-sm text-rose-300">{authError}</p>}

            <p className="mt-3 border-t border-slate-700/60 pt-3 text-xs text-slate-500">
                {added
                    ? `${added.addedBy} added this film on the site. `
                    : 'These four fields come from the Google Sheet until someone sets them here. '}
                Signed in as {member}.
            </p>
        </AccentCard>
    );
};

export default FilmDetailsEditor;
