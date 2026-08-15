import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Reorder, useDragControls } from 'framer-motion';
import { Bars3Icon, ChevronLeftIcon, TrashIcon } from '@heroicons/react/24/outline';

import PageLayout from '../components/layout/PageLayout';
import AccentCard from '../components/common/AccentCard';
import Button from '../components/common/Button';
import ErrorDisplay from '../components/common/ErrorDisplay';
import FilmSearchPicker from '../components/films/FilmSearchPicker';
import GoogleSignInButton from '../auth/GoogleSignInButton';
import { useClubAuth } from '../auth/GoogleAuth';
import {
    NEW_LIST_ID,
    deleteList,
    getLists,
    putList,
    type FilmSearchResult,
    type ListInput,
} from '../api/clubApi';
import { getListById, resolveListEntry } from '../utils/listUtils';
import type { FilmListDefinition } from '../types/list';

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

interface DraftEntry {
    imdbID: string;
    description: string;
    title: string | null;
    year: string | null;
    poster: string | null;
}

/** Matches the worker's caps, so a draft can't be built that the save would reject. */
const LIMITS = { name: 80, description: 1000, entryDescription: 500, entries: 100 };

const FIELD_CLASS =
    'w-full rounded-md border border-slate-600/60 bg-slate-800/60 px-3 py-2 text-slate-100 ' +
    'placeholder:text-slate-500 focus:border-amber-400/60 focus:outline-none';

const toDraft = (list: FilmListDefinition): DraftEntry[] =>
    [...list.entries]
        .sort((a, b) => a.rank - b.rank)
        .map((entry) => {
            const resolved = resolveListEntry(entry);
            return {
                imdbID: entry.imdbID,
                description: entry.description ?? '',
                title: resolved.title,
                year: resolved.year,
                poster: resolved.poster,
            };
        });

// --- One draggable row ---------------------------------------------------

interface EntryRowProps {
    entry: DraftEntry;
    rank: number;
    onNoteChange: (note: string) => void;
    onRemove: () => void;
}

/**
 * An editable row. Deliberately not `RankedListItem`: every element of that one
 * is a link to the film, and a stray click on a poster would navigate away from
 * a draft that hasn't been saved.
 *
 * Dragging is bound to the handle rather than the row (`dragListener={false}`),
 * so selecting text in the note textarea can't start a reorder.
 */
const EntryRow: React.FC<EntryRowProps> = ({ entry, rank, onNoteChange, onRemove }) => {
    const controls = useDragControls();

    return (
        <Reorder.Item
            value={entry}
            dragListener={false}
            dragControls={controls}
            className="flex items-start gap-3 rounded-xl border border-slate-600/30 bg-slate-700/25 p-3"
        >
            <button
                type="button"
                onPointerDown={(event) => controls.start(event)}
                aria-label={`Reorder ${entry.title ?? entry.imdbID}`}
                className="mt-1 cursor-grab touch-none rounded p-1 text-slate-500 hover:text-slate-300 active:cursor-grabbing"
            >
                <Bars3Icon className="h-5 w-5" aria-hidden="true" />
            </button>

            <span className="w-6 flex-shrink-0 select-none pt-1 text-center font-serif text-2xl tabular-nums leading-none text-slate-500/70">
                {rank}
            </span>

            {entry.poster ? (
                <img
                    src={entry.poster}
                    alt=""
                    loading="lazy"
                    className="h-[4.5rem] w-12 flex-shrink-0 rounded-md object-cover object-top ring-1 ring-slate-600/40"
                    onError={(e) => {
                        e.currentTarget.style.display = 'none';
                    }}
                />
            ) : (
                <span className="flex h-[4.5rem] w-12 flex-shrink-0 items-center justify-center rounded-md bg-slate-800 text-[10px] text-slate-600 ring-1 ring-slate-600/40">
                    ?
                </span>
            )}

            <div className="min-w-0 flex-grow">
                <div className="flex items-baseline gap-2">
                    <h5 className="truncate font-medium text-slate-200">
                        {entry.title ?? entry.imdbID}
                        {entry.year && <span className="ml-1.5 font-normal text-slate-500">{entry.year}</span>}
                    </h5>
                </div>
                <textarea
                    rows={2}
                    maxLength={LIMITS.entryDescription}
                    value={entry.description}
                    onChange={(e) => onNoteChange(e.target.value)}
                    placeholder="Why this one? (optional, Markdown)"
                    className={`${FIELD_CLASS} mt-1.5 text-sm`}
                />
            </div>

            <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={onRemove}
                aria-label={`Remove ${entry.title ?? entry.imdbID}`}
                className="mt-1 hover:text-rose-300"
            >
                <TrashIcon className="h-4 w-4" aria-hidden="true" />
            </Button>
        </Reorder.Item>
    );
};

// --- The page ------------------------------------------------------------

const ListEditorPage: React.FC = () => {
    const { listId } = useParams<{ listId: string }>();
    const navigate = useNavigate();
    const { configured, status, member, canEditAs, withToken, signOut } = useClubAuth();

    const creating = listId === undefined;

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
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

    // A late arrival from the live read must not overwrite work in progress, so
    // seeding checks this rather than the state it is about to replace.
    const touched = useRef(false);

    const seed = useCallback((list: FilmListDefinition) => {
        setName(list.name);
        setDescription(list.description ?? '');
        setEntries(toDraft(list));
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

    // Then the live copy from `main`, which is what makes editing a list twice
    // in a minute work (§8.8).
    useEffect(() => {
        if (creating || status !== 'signed-in') return;
        const controller = new AbortController();

        withToken((token) => getLists(token, controller.signal))
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
    }, [creating, listId, status, withToken, seed]);

    const chosen = useMemo(() => new Set(entries.map((entry) => entry.imdbID)), [entries]);

    const mutate = (next: DraftEntry[]) => {
        touched.current = true;
        setNotice(null);
        setSaveError(null);
        setEntries(next);
    };

    const addFilm = (hit: FilmSearchResult) => {
        if (chosen.has(hit.imdbID)) {
            setNotice(`${hit.title} is already on this list.`);
            return;
        }
        if (entries.length >= LIMITS.entries) {
            setNotice(`A list holds at most ${LIMITS.entries} films.`);
            return;
        }
        mutate([
            ...entries,
            {
                imdbID: hit.imdbID,
                description: '',
                title: hit.title,
                year: hit.year,
                poster: hit.poster,
            },
        ]);
    };

    const handleSave = async () => {
        const trimmedName = name.trim();
        if (trimmedName === '') {
            setSaveError('A list needs a name.');
            return;
        }

        const input: ListInput = {
            name: trimmedName,
            description: description.trim() === '' ? null : description.trim(),
            entries: entries.map((entry) => ({
                imdbID: entry.imdbID,
                description: entry.description.trim() === '' ? null : entry.description.trim(),
            })),
        };

        setSaving(true);
        setSaveError(null);
        setNotice(null);
        try {
            const { list } = await withToken((token) =>
                putList(token, listId ?? NEW_LIST_ID, input)
            );
            touched.current = false;
            // The worker assigns the permanent id on create, so where to go next
            // is its answer, not ours.
            navigate(`/lists/${list.id}`, { replace: true });
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Save failed.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!listId) return;
        setSaving(true);
        setSaveError(null);
        try {
            await withToken((token) => deleteList(token, listId));
            touched.current = false;
            navigate(owner ? `/profile/${encodeURIComponent(owner)}` : '/about', { replace: true });
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

            <AccentCard accent="amber" className="mb-8 p-4 sm:p-6 md:p-8">
                <div className="mb-6 flex items-center gap-3">
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

                {status !== 'signed-in' ? (
                    <div>
                        <p className="mb-3 text-sm text-slate-400">
                            Sign in with the Google account you gave the club to build your lists.
                        </p>
                        <GoogleSignInButton />
                    </div>
                ) : locked ? (
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
                                maxLength={LIMITS.name}
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
                                maxLength={LIMITS.description}
                                onChange={(e) => {
                                    touched.current = true;
                                    setDescription(e.target.value);
                                }}
                                placeholder="What ties these together? (optional, Markdown)"
                                className={FIELD_CLASS}
                            />
                        </label>

                        <FilmSearchPicker onPick={addFilm} chosen={chosen} accent="amber" />

                        {/* --- The draft, in rank order --- */}
                        <div>
                            <div className="mb-2 flex items-center gap-3">
                                <span className="text-xs uppercase tracking-wider text-slate-500">
                                    {entries.length} film{entries.length !== 1 ? 's' : ''} — drag to reorder
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
                                            onNoteChange={(note) =>
                                                mutate(
                                                    entries.map((candidate) =>
                                                        candidate.imdbID === entry.imdbID
                                                            ? { ...candidate, description: note }
                                                            : candidate
                                                    )
                                                )
                                            }
                                            onRemove={() =>
                                                mutate(
                                                    entries.filter(
                                                        (candidate) => candidate.imdbID !== entry.imdbID
                                                    )
                                                )
                                            }
                                        />
                                    ))}
                                </Reorder.Group>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 border-t border-slate-700/60 pt-4">
                            <Button
                                type="button"
                                variant="solid"
                                size="md"
                                accent="amber"
                                onClick={() => void handleSave()}
                                disabled={saving}
                            >
                                {saving ? 'Saving…' : creating ? 'Create list' : 'Save changes'}
                            </Button>
                            <span className="text-xs text-slate-500">
                                Saved lists appear on the site about a minute later.
                            </span>

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
                                <span className="ml-auto flex items-center gap-3 text-sm text-slate-400">
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
