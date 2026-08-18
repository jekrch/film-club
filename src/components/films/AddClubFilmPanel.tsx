import React, { useMemo, useState } from 'react';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';

import AccentCard from '../common/AccentCard';
import Button from '../common/Button';
import FilmClubFields from './FilmClubFields';
import FilmSearchPicker from './FilmSearchPicker';
import { useClubAuth } from '../../auth/GoogleAuth';
import { putFilm, type FilmSearchResult } from '../../api/clubApi';
import { useOverrides } from '../../contexts/OverridesContext';
import { filmData } from '../../types/film';
import {
    EMPTY_FILM_FORM,
    buildFilmPatch,
    parseFilmForm,
    type FilmFormValues,
} from '../../utils/filmEditUtils';

/**
 * Adding a film to the club, which used to mean opening the Google Sheet.
 *
 * A member searches OMDB, picks the film, says whose pick it was and when the
 * club watched it, and optionally points it at a better cover and a wide still
 * for the selection committee card. What that commits is a submission rather
 * than a film: the record itself — OMDb's response plus TMDb's crew, cast, and
 * stills — is built in CI on the next deploy, because the worker may not write
 * `films.json` and no browser should be assembling several kilobytes of it.
 *
 * So the film is not on the site the moment this closes. It is there about a
 * minute later, the same latency every other save here has, and the panel says
 * so in those words rather than leaving a member refreshing a 404.
 *
 * Films already in the club are shown disabled in the picker: the worker would
 * accept the write and treat it as an edit, which is right for the film's fields
 * and wrong as an answer to "add this film".
 */

interface AddClubFilmPanelProps {
    /** Called after a film is submitted, so the page can say something about it. */
    onAdded?: (hit: FilmSearchResult) => void;
}

const AddClubFilmPanel: React.FC<AddClubFilmPanelProps> = ({ onAdded }) => {
    const { configured, status, member, withToken, error: authError } = useClubAuth();
    const { films: overrides, applyFilm } = useOverrides();
    const [open, setOpen] = useState(false);
    const [picked, setPicked] = useState<FilmSearchResult | null>(null);
    const [form, setForm] = useState<FilmFormValues>(EMPTY_FILM_FORM);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    // Everything the club already has, bundled films and submissions that
    // haven't deployed yet alike — the second half is what stops a member
    // adding the same film twice in the two minutes before it appears.
    const clubFilmIds = useMemo(() => {
        const ids = new Set(filmData.map((entry) => entry.imdbID));
        for (const [imdbId, record] of Object.entries(overrides)) {
            if (record.added) ids.add(imdbId);
        }
        return ids;
    }, [overrides]);

    if (!configured || status !== 'signed-in') return null;

    const close = () => {
        setOpen(false);
        setPicked(null);
        setForm(EMPTY_FILM_FORM);
        setSaveError(null);
    };

    const update = (field: keyof FilmFormValues, value: string) => {
        setForm((current) => ({ ...current, [field]: value }));
        setNotice(null);
        setSaveError(null);
    };

    const handlePick = (hit: FilmSearchResult) => {
        setPicked(hit);
        // Seeded with the caller: a member adding a film is usually adding
        // their own pick, and it is one fewer field to fill in for the common
        // case. Wrong for the other case, and a dropdown away from right.
        setForm({ ...EMPTY_FILM_FORM, selector: member ?? '' });
        setSaveError(null);
        setNotice(null);
    };

    const handleSave = async () => {
        if (!picked) return;

        const parsed = parseFilmForm(form);
        if ('error' in parsed) {
            setSaveError(parsed.error);
            return;
        }

        setSaving(true);
        setSaveError(null);
        setNotice(null);
        try {
            // Diffed against a blank form, so a field the member left alone is
            // left out of the patch rather than written as a deliberate blank.
            const patch = buildFilmPatch(parsed.values, EMPTY_FILM_FORM);
            const result = await withToken((token) => putFilm(token, picked.imdbID, patch));

            applyFilm(picked.imdbID, { film: result.film, added: result.added });
            onAdded?.(picked);
            setNotice(
                `${picked.title} is on its way — it'll be on the site in a minute or two, once its ` +
                    'details come back from OMDb and TMDb.'
            );
            setPicked(null);
            setForm(EMPTY_FILM_FORM);
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Adding the film failed.');
        } finally {
            setSaving(false);
        }
    };

    if (!open) {
        return (
            <div className="mb-6">
                <Button
                    type="button"
                    variant="link"
                    size="sm"
                    accent="amber"
                    onClick={() => setOpen(true)}
                >
                    <PlusIcon className="h-4 w-4" aria-hidden="true" />
                    Add a club film
                </Button>
                {notice && <p className="mt-2 text-sm text-emerald-300">{notice}</p>}
            </div>
        );
    }

    return (
        <AccentCard accent="amber" surface="inset" className="mb-6 p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-3">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-amber-400">
                    Add a club film
                </h4>
                <span className="h-px flex-grow bg-gradient-to-r from-amber-400/25 via-slate-700/60 to-transparent" />
                <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={close}
                    aria-label="Close the add-film panel"
                >
                    <XMarkIcon className="h-4 w-4" aria-hidden="true" />
                </Button>
            </div>

            {picked === null ? (
                <FilmSearchPicker
                    onPick={handlePick}
                    chosen={clubFilmIds}
                    label="Find the film"
                    placeholder="Search OMDb by title…"
                    chosenLabel="in the club"
                />
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center gap-3 rounded-lg border border-slate-700/50 bg-slate-800/40 p-3">
                        {picked.poster && (
                            <img
                                src={picked.poster}
                                alt=""
                                className="h-16 w-11 flex-shrink-0 rounded object-cover object-top"
                            />
                        )}
                        <div className="min-w-0 flex-grow">
                            <p className="truncate font-medium text-slate-100">{picked.title}</p>
                            <p className="text-sm text-slate-500">
                                {picked.year ?? 'Year unknown'} · {picked.imdbID}
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="link"
                            size="xs"
                            onClick={() => setPicked(null)}
                            className="text-slate-400 hover:text-slate-200"
                        >
                            Pick a different film
                        </Button>
                    </div>

                    <FilmClubFields
                        values={form}
                        onChange={update}
                        disabled={saving}
                        accent="amber"
                    />

                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            type="button"
                            variant="solid"
                            size="sm"
                            accent="amber"
                            onClick={() => void handleSave()}
                            disabled={saving}
                        >
                            {saving ? 'Adding…' : 'Add the film'}
                        </Button>
                        <p className="text-xs italic text-slate-500">
                            Scores and reviews go on the film's own page once it lands.
                        </p>
                    </div>
                </div>
            )}

            {notice && <p className="mt-3 text-sm text-emerald-300">{notice}</p>}
            {saveError && <p className="mt-3 text-sm text-rose-300">{saveError}</p>}
            {authError && !saveError && <p className="mt-3 text-sm text-rose-300">{authError}</p>}
        </AccentCard>
    );
};

export default AddClubFilmPanel;
