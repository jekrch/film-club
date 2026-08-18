import React, { useState } from 'react';
import { PencilSquareIcon, PlusIcon, TrophyIcon, XMarkIcon } from '@heroicons/react/24/outline';

import AccentCard from '../common/AccentCard';
import Button from '../common/Button';
import Select from '../common/Select';
import { useClubAuth } from '../../auth/GoogleAuth';
import { NEW_TROPHY_ID, deleteTrophy, putTrophy } from '../../api/clubApi';
import type { Film } from '../../types/film';
import { teamMembers } from '../../types/team';
import type { Trophy } from '../../types/trophy';
import {
    AWARD_LIMIT,
    EMPTY_TROPHY_FORM,
    NOTE_LIMIT,
    canEditTrophy,
    parseTrophyForm,
    sameTrophyForm,
    toTrophyForm,
    type TrophyFormValues,
} from '../../utils/trophyEditUtils';

/**
 * Awarding a trophy on a club film.
 *
 * The one editing surface on this site that is not about the member using it.
 * Every other one — a score, a review, a list, a watch log — writes something
 * the caller owns, and the worker refuses anything else. A trophy is given
 * *to* someone else, so the recipient here is an ordinary field and any member
 * may pick any member.
 *
 * What that costs is a rule about taking one back: an award belongs to whoever
 * handed it out, and only they (or an admin) may edit or withdraw it. So the
 * rows below split in two — the ones with buttons, and the ones that just say
 * who gave them. `canEditTrophy` decides, and the worker decides again.
 *
 * Rendered only for a signed-in member, and collapsed until asked for. A save
 * commits to the repo and is live after the next Pages build, about a minute;
 * the panel therefore reports success in words rather than waiting on it.
 */

interface FilmTrophyEditorProps {
    film: Film;
    /** The film's awards as `trophies.json` has them, freshest copy available. */
    trophies: Trophy[];
    /** True while the live read is in flight, so the panel doesn't offer stale rows. */
    loading: boolean;
    onSaved: (trophy: Trophy) => void;
    onWithdrawn: (id: string) => void;
}

const FIELD_CLASS =
    'w-full rounded-md border border-slate-600/60 bg-slate-800/60 px-3 py-2 text-slate-100 ' +
    'placeholder:text-slate-500 focus:border-amber-400/60 focus:outline-none';

const FilmTrophyEditor: React.FC<FilmTrophyEditorProps> = ({
    film,
    trophies,
    loading,
    onSaved,
    onWithdrawn,
}) => {
    const { configured, status, member, admin, withToken, error: authError } = useClubAuth();
    const [open, setOpen] = useState(false);
    /** The award being edited, `NEW_TROPHY_ID` while awarding, or null when the form is closed. */
    const [editing, setEditing] = useState<string | null>(null);
    const [form, setForm] = useState<TrophyFormValues>(EMPTY_TROPHY_FORM);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [confirmingWithdraw, setConfirmingWithdraw] = useState<string | null>(null);

    if (!configured || status !== 'signed-in') return null;

    const memberOptions = teamMembers
        .filter((entry) => entry.name)
        .map((entry) => ({ value: entry.name, label: entry.name }));

    const startAwarding = () => {
        setEditing(NEW_TROPHY_ID);
        // Seeded with the caller only as a default the select shows; awarding
        // yourself a trophy is allowed, if a little sad.
        setForm({ ...EMPTY_TROPHY_FORM, recipient: member ?? '' });
        setSaveError(null);
        setNotice(null);
    };

    const startEditing = (trophy: Trophy) => {
        setEditing(trophy.id);
        setForm(toTrophyForm(trophy));
        setSaveError(null);
        setNotice(null);
    };

    const closeForm = () => {
        setEditing(null);
        setForm(EMPTY_TROPHY_FORM);
    };

    const update = (field: keyof TrophyFormValues, value: string) => {
        setForm((current) => ({ ...current, [field]: value }));
        setNotice(null);
        setSaveError(null);
    };

    const original = editing === null ? null : trophies.find((trophy) => trophy.id === editing);
    const dirty =
        original === null ||
        original === undefined ||
        !sameTrophyForm(form, toTrophyForm(original));

    const handleSave = async () => {
        if (editing === null) return;

        const parsed = parseTrophyForm(form);
        if ('error' in parsed) {
            setSaveError(parsed.error);
            return;
        }

        setSaving(true);
        setSaveError(null);
        setNotice(null);
        try {
            const result = await withToken((token) =>
                putTrophy(token, film.imdbID, editing, parsed.input)
            );
            onSaved(result.trophy);
            closeForm();
            setNotice(
                result.changed
                    ? `${result.trophy.recipient} gets the ${result.trophy.award} — live on the site in about a minute.`
                    : 'Already saved; nothing changed.'
            );
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Save failed.');
        } finally {
            setSaving(false);
        }
    };

    const handleWithdraw = async (trophy: Trophy) => {
        setSaving(true);
        setSaveError(null);
        setNotice(null);
        try {
            await withToken((token) => deleteTrophy(token, film.imdbID, trophy.id));
            onWithdrawn(trophy.id);
            setConfirmingWithdraw(null);
            if (editing === trophy.id) closeForm();
            setNotice(`Withdrew the ${trophy.award}.`);
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Withdrawing failed.');
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
                    className="text-slate-400 hover:text-amber-300"
                >
                    <TrophyIcon className="h-4 w-4" aria-hidden="true" />
                    Award a trophy
                </Button>
            </div>
        );
    }

    return (
        <AccentCard accent="amber" surface="inset" className="mt-6 p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-3">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-amber-400">
                    Trophies for {film.title}
                </h4>
                <span className="h-px flex-grow bg-gradient-to-r from-amber-400/25 via-slate-700/60 to-transparent" />
                <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                        setOpen(false);
                        closeForm();
                    }}
                    aria-label="Close the trophy editor"
                >
                    <XMarkIcon className="h-4 w-4" aria-hidden="true" />
                </Button>
            </div>

            {/* Only the awards given here are listed: the sheet's `trophyNotes`
                are a different column, written in the spreadsheet and not
                editable from the site. They still render in the gallery above. */}
            {trophies.length > 0 && (
                <ul className="mb-4 space-y-2">
                    {trophies.map((trophy) => {
                        const mine = canEditTrophy(trophy, member, admin);
                        return (
                            <li
                                key={trophy.id}
                                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-slate-700/50 bg-slate-800/40 px-3 py-2 text-sm"
                            >
                                <span className="font-medium text-amber-200/90">
                                    {trophy.recipient}
                                </span>
                                <span className="text-slate-300">{trophy.award}</span>
                                {trophy.note && (
                                    <span className="italic text-slate-500">{trophy.note}</span>
                                )}
                                <span className="ml-auto text-xs text-slate-500">
                                    given by {trophy.awardedBy}
                                </span>

                                {mine && confirmingWithdraw !== trophy.id && (
                                    <span className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="link"
                                            size="xs"
                                            onClick={() => startEditing(trophy)}
                                            disabled={saving || loading}
                                            className="text-slate-400 hover:text-amber-300"
                                        >
                                            <PencilSquareIcon
                                                className="h-3.5 w-3.5"
                                                aria-hidden="true"
                                            />
                                            Edit
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="link"
                                            size="xs"
                                            accent="rose"
                                            onClick={() => setConfirmingWithdraw(trophy.id)}
                                            disabled={saving || loading}
                                        >
                                            Withdraw
                                        </Button>
                                    </span>
                                )}
                                {mine && confirmingWithdraw === trophy.id && (
                                    <span className="flex items-center gap-3 text-xs text-slate-400">
                                        Take this trophy back?
                                        <Button
                                            type="button"
                                            variant="link"
                                            size="xs"
                                            accent="rose"
                                            onClick={() => void handleWithdraw(trophy)}
                                            disabled={saving}
                                        >
                                            Withdraw
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="link"
                                            size="xs"
                                            onClick={() => setConfirmingWithdraw(null)}
                                            className="text-slate-400 hover:text-slate-200"
                                        >
                                            Cancel
                                        </Button>
                                    </span>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {editing === null ? (
                <Button
                    type="button"
                    variant="link"
                    size="sm"
                    accent="amber"
                    onClick={startAwarding}
                    disabled={loading}
                >
                    <PlusIcon className="h-4 w-4" aria-hidden="true" />
                    Award a trophy
                </Button>
            ) : (
                <div className="space-y-4 border-t border-slate-700/60 pt-4">
                    <div className="flex flex-wrap items-end gap-4">
                        <Select
                            label="Goes to"
                            value={form.recipient}
                            onChange={(value) => update('recipient', value)}
                            options={memberOptions}
                            placeholder="Pick a member"
                            className="w-44"
                        />
                        <label className="block min-w-48 flex-1">
                            <span className="mb-1 block text-xs uppercase tracking-wider text-slate-500">
                                Trophy
                            </span>
                            <input
                                type="text"
                                maxLength={AWARD_LIMIT}
                                value={form.award}
                                onChange={(e) => update('award', e.target.value)}
                                disabled={saving || loading}
                                placeholder="Togetherness Trophy"
                                className={FIELD_CLASS}
                            />
                        </label>
                    </div>

                    <label className="block">
                        <span className="mb-1 block text-xs uppercase tracking-wider text-slate-500">
                            Note <span className="normal-case tracking-normal">(optional)</span>
                        </span>
                        <input
                            type="text"
                            maxLength={NOTE_LIMIT}
                            value={form.note}
                            onChange={(e) => update('note', e.target.value)}
                            disabled={saving || loading}
                            placeholder="for having a lot of work to do"
                            className={FIELD_CLASS}
                        />
                    </label>

                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            type="button"
                            variant="solid"
                            size="sm"
                            accent="amber"
                            onClick={() => void handleSave()}
                            disabled={saving || loading || !dirty}
                        >
                            {saving ? 'Saving…' : editing === NEW_TROPHY_ID ? 'Award it' : 'Save'}
                        </Button>
                        <Button
                            type="button"
                            variant="link"
                            size="sm"
                            onClick={closeForm}
                            disabled={saving}
                            className="text-slate-400 hover:text-slate-200"
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            )}

            {notice && <p className="mt-3 text-sm text-emerald-300">{notice}</p>}
            {saveError && <p className="mt-3 text-sm text-rose-300">{saveError}</p>}
            {authError && !saveError && <p className="mt-3 text-sm text-rose-300">{authError}</p>}
        </AccentCard>
    );
};

export default FilmTrophyEditor;
