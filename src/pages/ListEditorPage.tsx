import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Reorder } from 'framer-motion';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';

import PageLayout from '../components/layout/PageLayout';
import AccentCard from '../components/common/AccentCard';
import Button from '../components/common/Button';
import ErrorDisplay from '../components/common/ErrorDisplay';
import FilmSearchPicker from '../components/films/FilmSearchPicker';
import EntryRow from '../components/films/ListEntryRow';
import { useClubAuth } from '../auth/GoogleAuth';
import { NEW_LIST_ID, deleteList, putList, type FilmSearchResult } from '../api/clubApi';
import { fetchLists } from '../api/repoData';
import { recordWrite, writeKeys } from '../api/writeCache';
import { getListById } from '../utils/listUtils';
import {
    LIST_LIMITS,
    addFilmToDraft,
    buildListInput,
    listExitPath,
    moveDraftEntry,
    patchDraftEntry,
    profilePath,
    removeDraftEntry,
    toDraftEntries,
    type DraftEntry,
} from '../utils/listEditUtils';
import { isRankedList, type FilmListDefinition } from '../types/list';

/**
 * The list editor: `/lists/new` and `/lists/:listId/edit` (§8.9).
 *
 * Writes are whole-list, not per-entry — the draft lives here in local state
 * until the member presses Save, which keeps the commit count low and makes
 * each commit a readable diff (§8.4).
 *
 * A draft entry carries its own title, year, and poster. For an existing list
 * those come from whichever source already knows the film; for one just added
 * they come from the search result. Either way the editor never waits on the CI
 * step that fills `listFilms.json` (§8.8).
 */

const FIELD_CLASS =
    'w-full rounded-md border border-slate-600/60 bg-slate-800/60 px-3 py-2 text-slate-100 ' +
    'placeholder:text-slate-500 focus:border-amber-400/60 focus:outline-none';

// --- The page ------------------------------------------------------------

const ListEditorPage: React.FC = () => {
    const { listId } = useParams<{ listId: string }>();
    const navigate = useNavigate();
    const { configured, status, member, canEditAs, withToken, signOut } = useClubAuth();

    const creating = listId === undefined;

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [ranked, setRanked] = useState(true);
    const [entries, setEntries] = useState<DraftEntry[]>([]);
    const [owner, setOwner] = useState<string | null>(null);
    /** True once the list has been found in either source. */
    const [found, setFound] = useState(creating);
    /**
     * True once the live read from `main` has answered. A list saved a minute
     * ago is in neither the bundle nor this page's state, so "not found" is only
     * honest after that read — before it, the id may simply not have deployed.
     */
    const [liveChecked, setLiveChecked] = useState(false);

    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [confirmingCancel, setConfirmingCancel] = useState(false);

    // A late arrival from the live read must not overwrite work in progress, so
    // seeding checks this rather than the state it is about to replace.
    const touched = useRef(false);

    const seed = useCallback((list: FilmListDefinition) => {
        setName(list.name);
        setDescription(list.description ?? '');
        setRanked(isRankedList(list));
        setEntries(toDraftEntries(list));
        setOwner(list.owner);
        setFound(true);
    }, []);

    // The bundle renders instantly and is right except for saves that haven't
    // deployed yet.
    useEffect(() => {
        if (creating) return;
        const bundled = getListById(listId);
        if (bundled && !touched.current) seed(bundled);
    }, [creating, listId, seed]);

    // Then the live copy from the repo, which is what makes editing a list
    // twice in a minute work (§8.8).
    useEffect(() => {
        if (creating || status !== 'signed-in') return;
        const controller = new AbortController();

        fetchLists(controller.signal)
            .then((lists) => {
                if (controller.signal.aborted) return;
                setLiveChecked(true);
                const live = lists.find((list) => list.id === listId);
                if (live && !touched.current) seed(live);
            })
            .catch(() => {
                // The bundled copy is already on screen; a failed refresh means
                // it might be a minute stale, not that editing is impossible. It
                // is not evidence the list is missing, so `liveChecked` stays
                // false and the 404 below is never reached on a network blip.
            });

        return () => controller.abort();
    }, [creating, listId, status, seed]);

    const chosen = useMemo(() => new Set(entries.map((entry) => entry.imdbID)), [entries]);

    const mutate = (next: DraftEntry[]) => {
        touched.current = true;
        setNotice(null);
        setSaveError(null);
        setEntries(next);
    };

    const addFilm = (hit: FilmSearchResult) => {
        const result = addFilmToDraft(entries, hit, owner ?? member ?? undefined);
        if ('notice' in result) {
            setNotice(result.notice);
            return;
        }
        mutate(result.entries);
    };

    /** Replaces one row's editable fields, leaving the rest of the draft alone. */
    const patchEntry = (imdbID: string, patch: Partial<DraftEntry>) =>
        mutate(patchDraftEntry(entries, imdbID, patch));

    /** The arrow controls' half of reordering — a swap with the neighbour. */
    const moveEntry = (index: number, direction: -1 | 1) => {
        const next = moveDraftEntry(entries, index, direction);
        // An arrow at the end of the list is disabled, so this is belt and
        // braces — but a no-op `mutate` would still mark the draft touched and
        // arm the discard confirmation.
        if (next !== entries) mutate(next);
    };

    const handleSave = async () => {
        const built = buildListInput({ name, description, ranked, entries });
        if ('error' in built) {
            setSaveError(built.error);
            return;
        }
        const { input } = built;

        setSaving(true);
        setSaveError(null);
        setNotice(null);
        try {
            const { list } = await withToken((token) =>
                putList(token, listId ?? NEW_LIST_ID, input)
            );
            touched.current = false;
            // Keyed by the worker's id rather than the one in the URL: on a
            // create they differ, and the id it assigned is the one the list
            // page is about to look for.
            recordWrite('list', writeKeys.list(list.id), list);
            // The worker assigns the permanent id on create, so where to go next
            // is its answer, not ours.
            navigate(`/lists/${list.id}`, { replace: true });
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Save failed.');
        } finally {
            setSaving(false);
        }
    };

    /**
     * Leaves the draft behind for the list as it is stored: the list's own page
     * when it exists, the owner's profile when this was a create that never
     * happened. `replace` so Back doesn't return to an editor whose state is
     * gone.
     *
     * An untouched draft leaves at once — the confirm is only worth a click when
     * there is something to lose.
     */
    const handleCancel = () => {
        if (touched.current && !confirmingCancel) {
            setConfirmingCancel(true);
            return;
        }
        navigate(listExitPath({ listId, owner, member }), { replace: true });
    };

    const handleDelete = async () => {
        if (!listId) return;
        setSaving(true);
        setSaveError(null);
        try {
            await withToken((token) => deleteList(token, listId));
            touched.current = false;
            recordWrite('list', writeKeys.list(listId), null);
            // The list's own page is gone, so there is nowhere to go but the
            // owner's profile — never `member`'s, since an admin who deleted
            // someone else's list should land where the list was.
            navigate(profilePath(owner), { replace: true });
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Delete failed.');
            setSaving(false);
        }
    };

    if (!configured) {
        return (
            <ErrorDisplay
                message="Editing isn't available on this build."
                backPath="/about"
                backButtonLabel="Back to About Page"
            />
        );
    }

    if (!creating && !found && liveChecked) {
        return (
            <ErrorDisplay
                message={`List "${listId}" not found.`}
                backPath="/about"
                backButtonLabel="Back to About Page"
            />
        );
    }

    // Ownership is enforced by the worker regardless; this only saves someone
    // the trouble of filling in a form whose save would 403.
    const locked = !creating && owner !== null && status === 'signed-in' && !canEditAs(owner);

    return (
        <PageLayout>
            <Button onClick={() => navigate(-1)} variant="link" size="md" className="mb-8 group">
                <ChevronLeftIcon
                    className="h-5 w-5 transition-transform group-hover:-translate-x-1"
                    aria-hidden="true"
                />
                Back
            </Button>

            <AccentCard accent="amber" className="mb-8 p-3 sm:p-6 md:p-8">
                {/* Wraps rather than squeezing: the signed-in line is
                    `whitespace-nowrap`, so on a narrow screen it would take its
                    width out of the heading instead. */}
                <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h1 className="text-2xl font-thin text-slate-100">
                        {creating ? 'New list' : 'Edit list'}
                    </h1>
                    <span className="h-px flex-grow bg-gradient-to-r from-amber-400/25 via-slate-700/60 to-transparent" />
                    {status === 'signed-in' && (
                        <span className="whitespace-nowrap text-xs text-slate-500">
                            {member}
                            {' · '}
                            <Button
                                type="button"
                                variant="link"
                                size="xs"
                                onClick={signOut}
                                className="text-slate-400 hover:text-slate-200"
                            >
                                Sign out
                            </Button>
                        </span>
                    )}
                </div>

                {status !== 'signed-in' ? null : locked ? (
                    <p className="text-slate-400">
                        This list belongs to {owner}. Only its owner can edit it.
                    </p>
                ) : (
                    <div className="space-y-6">
                        <label className="block">
                            <span className="mb-1 block text-xs uppercase tracking-wider text-slate-500">
                                Name
                            </span>
                            <input
                                type="text"
                                value={name}
                                maxLength={LIST_LIMITS.name}
                                onChange={(e) => {
                                    touched.current = true;
                                    setName(e.target.value);
                                }}
                                placeholder="Top 10 Horror Films"
                                className={FIELD_CLASS}
                            />
                        </label>

                        <label className="block">
                            <span className="mb-1 block text-xs uppercase tracking-wider text-slate-500">
                                Description
                            </span>
                            <textarea
                                rows={3}
                                value={description}
                                maxLength={LIST_LIMITS.description}
                                onChange={(e) => {
                                    touched.current = true;
                                    setDescription(e.target.value);
                                }}
                                placeholder="What ties these together? (optional, Markdown)"
                                className={FIELD_CLASS}
                            />
                        </label>

                        {/* Ordering is never in question — the draft is a
                            sequence and dragging is how it's set. What this
                            decides is whether the list claims that sequence is a
                            ranking. */}
                        <div>
                            <label className="flex items-center gap-2.5">
                                <input
                                    type="checkbox"
                                    checked={ranked}
                                    onChange={(e) => {
                                        touched.current = true;
                                        setRanked(e.target.checked);
                                    }}
                                    className="h-4 w-4 rounded border-slate-600/60 bg-slate-800/60 text-amber-500 focus:ring-amber-400/60"
                                />
                                <span className="text-sm text-slate-300">Numbered ranking</span>
                            </label>
                            <p className="mt-1 pl-[1.625rem] text-xs italic text-slate-500">
                                Off, the films show as a plain list. They stay in the order you
                                arrange them either way.
                            </p>
                        </div>

                        <FilmSearchPicker onPick={addFilm} chosen={chosen} accent="amber" />

                        {/* --- The draft, in order --- */}
                        <div>
                            <div className="mb-2 flex items-center gap-3">
                                <span className="text-xs uppercase tracking-wider text-slate-500">
                                    {entries.length} film{entries.length !== 1 ? 's' : ''} — drag or
                                    use the arrows to reorder
                                </span>
                                <span className="h-px flex-grow bg-slate-700/60" />
                            </div>

                            {entries.length === 0 ? (
                                <p className="py-6 text-center italic text-slate-500">
                                    Nothing here yet. Search above to add the first film.
                                </p>
                            ) : (
                                <Reorder.Group
                                    axis="y"
                                    values={entries}
                                    onReorder={mutate}
                                    className="space-y-2"
                                >
                                    {entries.map((entry, index) => (
                                        <EntryRow
                                            key={entry.imdbID}
                                            entry={entry}
                                            rank={index + 1}
                                            ranked={ranked}
                                            isFirst={index === 0}
                                            isLast={index === entries.length - 1}
                                            onMove={(direction) => moveEntry(index, direction)}
                                            onNoteChange={(note) =>
                                                patchEntry(entry.imdbID, { description: note })
                                            }
                                            onImageChange={(image) =>
                                                patchEntry(entry.imdbID, { image })
                                            }
                                            onPosterImageChange={(posterImage) =>
                                                patchEntry(entry.imdbID, { posterImage })
                                            }
                                            onTrailerChange={(trailer) =>
                                                patchEntry(entry.imdbID, { trailer })
                                            }
                                            onHideTrailerChange={(hideTrailer) =>
                                                patchEntry(entry.imdbID, { hideTrailer })
                                            }
                                            onScoreChange={(score) =>
                                                patchEntry(entry.imdbID, { score })
                                            }
                                            onRemove={() =>
                                                mutate(removeDraftEntry(entries, entry.imdbID))
                                            }
                                        />
                                    ))}
                                </Reorder.Group>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-slate-700/60 pt-4">
                            {/* Full width on a phone: it is the one action the
                                page exists for, and at its natural width it
                                shares a line with Cancel, which is a thumb's
                                width away from the button that discards the
                                draft. */}
                            <Button
                                type="button"
                                variant="solid"
                                size="md"
                                accent="amber"
                                onClick={() => void handleSave()}
                                disabled={saving}
                                className="w-full sm:w-auto"
                            >
                                {saving ? 'Saving…' : creating ? 'Create list' : 'Save changes'}
                            </Button>
                            {!confirmingCancel && (
                                <Button
                                    type="button"
                                    variant="link"
                                    size="sm"
                                    onClick={handleCancel}
                                    disabled={saving}
                                    className="text-slate-400 hover:text-slate-200"
                                >
                                    Cancel
                                </Button>
                            )}

                            {confirmingCancel ? (
                                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400">
                                    Discard your changes?
                                    <Button
                                        type="button"
                                        variant="link"
                                        size="sm"
                                        accent="rose"
                                        onClick={handleCancel}
                                        disabled={saving}
                                    >
                                        Discard
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="link"
                                        size="sm"
                                        onClick={() => setConfirmingCancel(false)}
                                        className="text-slate-400 hover:text-slate-200"
                                    >
                                        Keep editing
                                    </Button>
                                </span>
                            ) : (
                                <span className="text-xs text-slate-500">
                                    Saved lists appear on the site about a minute later.
                                </span>
                            )}

                            {!creating && !confirmingDelete && (
                                <Button
                                    type="button"
                                    variant="link"
                                    size="sm"
                                    accent="rose"
                                    onClick={() => setConfirmingDelete(true)}
                                    disabled={saving}
                                    className="ml-auto"
                                >
                                    Delete list
                                </Button>
                            )}
                            {!creating && confirmingDelete && (
                                <span className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400 sm:ml-auto sm:w-auto">
                                    Delete "{name}" for good?
                                    <Button
                                        type="button"
                                        variant="link"
                                        size="sm"
                                        accent="rose"
                                        onClick={() => void handleDelete()}
                                        disabled={saving}
                                    >
                                        Delete
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="link"
                                        size="sm"
                                        onClick={() => setConfirmingDelete(false)}
                                        className="text-slate-400 hover:text-slate-200"
                                    >
                                        Cancel
                                    </Button>
                                </span>
                            )}
                        </div>

                        {notice && <p className="text-sm text-amber-300">{notice}</p>}
                        {saveError && <p className="text-sm text-rose-300">{saveError}</p>}
                    </div>
                )}
            </AccentCard>
        </PageLayout>
    );
};

export default ListEditorPage;
