import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Reorder, useDragControls } from 'framer-motion';
import {
    Bars3Icon,
    ChevronDownIcon,
    ChevronLeftIcon,
    ChevronUpIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';

import PageLayout from '../components/layout/PageLayout';
import AccentCard from '../components/common/AccentCard';
import Button from '../components/common/Button';
import ImageUrlPreview from '../components/common/ImageUrlPreview';
import ErrorDisplay from '../components/common/ErrorDisplay';
import FilmSearchPicker from '../components/films/FilmSearchPicker';
import { useClubAuth } from '../auth/GoogleAuth';
import {
    NEW_LIST_ID,
    deleteList,
    putList,
    type FilmSearchResult,
    type ListInput,
} from '../api/clubApi';
import { fetchLists } from '../api/repoData';
import { recordWrite, writeKeys } from '../api/writeCache';
import { getListById, resolveListEntry, type ScoreSource } from '../utils/listUtils';
import { IMAGE_URL_LIMIT, parseImageUrl } from '../utils/imageUrl';
import { TRAILER_URL_LIMIT, parseTrailerLink } from '../utils/youtube';
import { MAX_SCORE, SCORE_STEP, parseScoreField } from '../utils/ratingEditUtils';
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

interface DraftEntry {
    imdbID: string;
    description: string;
    /** The member's own background art for the row; empty means the film's own. */
    image: string;
    /** The member's own poster for the film; empty means the one OMDB supplied. */
    posterImage: string;
    /** The member's own trailer link as typed; empty means the film's own. */
    trailer: string;
    /** True when this row should offer no trailer at all; wins over {@link trailer}. */
    hideTrailer: boolean;
    /** The owner's score for this pick, empty for "whatever I've scored it elsewhere". */
    score: string;
    /**
     * The score the row would show if {@link score} stays empty — from the
     * owner's watch log or their club rating — and where it comes from. Shown as
     * the field's placeholder so nobody retypes a score they already gave.
     */
    inheritedScore: number | null;
    inheritedFrom: ScoreSource | null;
    title: string | null;
    year: string | null;
    /**
     * The *film's* poster, never the member's override — the row draws
     * {@link posterImage} over it and has to be able to fall back the moment
     * that field is cleared, which a resolved poster with the override already
     * baked in couldn't do.
     */
    poster: string | null;
}

/** How an inherited score reads in the hint under the field. */
const INHERITED_FROM_LABEL: Record<ScoreSource, string> = {
    entry: 'this list',
    log: 'your watch log',
    club: 'your club rating',
};

/** Matches the worker's caps, so a draft can't be built that the save would reject. */
const LIMITS = { name: 80, description: 1000, entryDescription: 500, entries: 100 };

const FIELD_CLASS =
    'w-full rounded-md border border-slate-600/60 bg-slate-800/60 px-3 py-2 text-slate-100 ' +
    'placeholder:text-slate-500 focus:border-amber-400/60 focus:outline-none';

/**
 * The same field, one step down in size — but only once there is room for it.
 * Mobile Safari zooms the page in on any field it focuses whose text is under
 * 16px, and it does not zoom back out, so a row field that reads `text-sm` on a
 * phone costs the member their whole viewport for the rest of the edit.
 */
const ROW_FIELD_CLASS = `${FIELD_CLASS} text-base sm:text-sm`;

/**
 * How far the fields under a row are indented on a wide screen, so they line up
 * with the title rather than the reorder controls. It is the width of
 * everything left of the title — controls (2rem), rank (1.5rem), poster (3rem)
 * and the three `gap-3`s between them, 8.75rem in all. On a phone there is no
 * room to give away, so the fields start at the row's own edge instead.
 */
const FIELD_INDENT = 'sm:pl-35';

/**
 * What the row would score without a score of its own — the owner's watch log,
 * then their club rating. Resolved from an entry with its score stripped, so it
 * answers "what does this fall back to" rather than "what does it show now".
 */
const inheritedScoreFor = (
    imdbID: string,
    owner: string | undefined
): Pick<DraftEntry, 'inheritedScore' | 'inheritedFrom'> => {
    const { score, scoreSource } = resolveListEntry(
        { rank: 0, imdbID, description: null, score: null },
        {},
        owner
    );
    return { inheritedScore: score, inheritedFrom: scoreSource };
};

const toDraft = (list: FilmListDefinition): DraftEntry[] =>
    [...list.entries]
        .sort((a, b) => a.rank - b.rank)
        .map((entry) => {
            // Resolved with the poster override stripped, so `poster` is the
            // film's own — see {@link DraftEntry.poster}. Everywhere outside
            // this editor wants the resolved poster and passes the entry whole.
            const resolved = resolveListEntry({ ...entry, posterImage: null }, {}, list.owner);
            return {
                imdbID: entry.imdbID,
                description: entry.description ?? '',
                image: entry.image ?? '',
                posterImage: entry.posterImage ?? '',
                trailer: entry.trailerKey ?? '',
                hideTrailer: entry.hideTrailer ?? false,
                score: entry.score === null || entry.score === undefined ? '' : String(entry.score),
                ...inheritedScoreFor(entry.imdbID, list.owner),
                title: resolved.title,
                year: resolved.year,
                poster: resolved.poster,
            };
        });

// --- One draggable row ---------------------------------------------------

interface EntryRowProps {
    entry: DraftEntry;
    rank: number;
    /** False on an unranked list, where the row shows a bullet instead. */
    ranked: boolean;
    /** Both true on a one-film list; each disables the arrow it bounds. */
    isFirst: boolean;
    isLast: boolean;
    onMove: (direction: -1 | 1) => void;
    onNoteChange: (note: string) => void;
    onImageChange: (image: string) => void;
    onPosterImageChange: (posterImage: string) => void;
    onTrailerChange: (trailer: string) => void;
    onHideTrailerChange: (hideTrailer: boolean) => void;
    onScoreChange: (score: string) => void;
    onRemove: () => void;
}

/**
 * An editable row. Deliberately not `RankedListItem`: every element of that one
 * is a link to the film, and a stray click on a poster would navigate away from
 * a draft that hasn't been saved.
 *
 * Dragging is bound to the handle rather than the row (`dragListener={false}`),
 * so selecting text in the note textarea can't start a reorder.
 *
 * The row is a header — controls, rank, poster, title — with the fields
 * underneath rather than beside them. Nested in the title's column they were
 * left about 110px on a phone, since the chrome to their left is a fixed width
 * that a narrow screen doesn't shrink; below it, every field gets the row.
 */
const EntryRow: React.FC<EntryRowProps> = ({
    entry,
    rank,
    ranked,
    isFirst,
    isLast,
    onMove,
    onNoteChange,
    onImageChange,
    onPosterImageChange,
    onTrailerChange,
    onHideTrailerChange,
    onScoreChange,
    onRemove,
}) => {
    const controls = useDragControls();
    const label = entry.title ?? entry.imdbID;
    // What the row will actually show once saved, kept live as the field is
    // typed in — including back to the film's own poster when it is cleared.
    const rowPoster = entry.posterImage.trim() === '' ? entry.poster : entry.posterImage.trim();
    const inherited =
        entry.inheritedScore !== null && entry.inheritedFrom !== null
            ? `${entry.inheritedScore} from ${INHERITED_FROM_LABEL[entry.inheritedFrom]}`
            : null;

    return (
        <Reorder.Item
            value={entry}
            dragListener={false}
            dragControls={controls}
            className="rounded-xl border border-slate-600/30 bg-slate-700/25 p-2.5 sm:p-3"
        >
            <div className="flex items-start gap-2 sm:gap-3">
                {/* Drag is the fast way to move a film and the arrows are the
                    reliable one: a drag on a phone fights the page's own scroll,
                    and framer's reorder doesn't scroll the window, so on a list
                    longer than the screen dragging alone can't reach the far
                    end. The arrows are also the only reorder a keyboard has. */}
                <div className="flex w-9 flex-shrink-0 flex-col items-center sm:w-8">
                    <button
                        type="button"
                        onClick={() => onMove(-1)}
                        disabled={isFirst}
                        aria-label={`Move ${label} up`}
                        className="rounded p-2 text-slate-500 transition-colors hover:text-slate-300 disabled:opacity-25 disabled:hover:text-slate-500 sm:p-1.5"
                    >
                        <ChevronUpIcon className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        onPointerDown={(event) => controls.start(event)}
                        aria-label={`Reorder ${label} by dragging`}
                        className="cursor-grab touch-none rounded p-2 text-slate-500 transition-colors hover:text-slate-300 active:cursor-grabbing sm:p-1.5"
                    >
                        <Bars3Icon className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        onClick={() => onMove(1)}
                        disabled={isLast}
                        aria-label={`Move ${label} down`}
                        className="rounded p-2 text-slate-500 transition-colors hover:text-slate-300 disabled:opacity-25 disabled:hover:text-slate-500 sm:p-1.5"
                    >
                        <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>

                {/* The position is worth showing either way — it is what dragging
                    changes — but only a ranking states it as a number. */}
                <span className="w-6 flex-shrink-0 select-none pt-1 text-center font-serif text-xl tabular-nums leading-none text-slate-500/70 sm:text-2xl">
                    {ranked ? (
                        rank
                    ) : (
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-500/70 align-middle" />
                    )}
                </span>

                {rowPoster ? (
                    <img
                        src={rowPoster}
                        alt=""
                        loading="lazy"
                        className="h-[4.5rem] w-12 flex-shrink-0 rounded-md object-cover object-top ring-1 ring-slate-600/40"
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                        }}
                        // Restored on load, since this element now shows a URL
                        // the member is still typing: without it the first
                        // half-typed address would hide the thumb for good.
                        onLoad={(e) => {
                            e.currentTarget.style.display = '';
                        }}
                    />
                ) : (
                    <span className="flex h-[4.5rem] w-12 flex-shrink-0 items-center justify-center rounded-md bg-slate-800 text-[10px] text-slate-600 ring-1 ring-slate-600/40">
                        ?
                    </span>
                )}

                <div className="min-w-0 flex-grow pt-0.5">
                    {/* Wraps on a phone rather than truncating: the title is all
                        that identifies the row there, and the width left for it
                        can't hold much of one. */}
                    <h5 className="break-words font-medium text-slate-200 sm:truncate">
                        {entry.title ?? entry.imdbID}
                        {entry.year && (
                            <span className="ml-1.5 font-normal text-slate-500">{entry.year}</span>
                        )}
                    </h5>
                </div>

                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onRemove}
                    aria-label={`Remove ${label}`}
                    className="-mt-0.5 flex-shrink-0 hover:text-rose-300"
                >
                    <TrashIcon className="h-4 w-4" aria-hidden="true" />
                </Button>
            </div>

            <div className={`mt-2 space-y-2 ${FIELD_INDENT}`}>
                {/* Left blank, the row shows whatever score the member has given
                    the film elsewhere — the placeholder is that score, so an
                    empty field reads as "the one I already gave" and not as
                    "unscored". Typing here overrides it for this list only. */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <label className="flex flex-shrink-0 items-center gap-1.5 text-xs uppercase tracking-wider text-slate-500">
                        Score
                        <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={MAX_SCORE}
                            step={SCORE_STEP}
                            value={entry.score}
                            onChange={(e) => onScoreChange(e.target.value)}
                            placeholder={
                                entry.inheritedScore === null ? '—' : String(entry.inheritedScore)
                            }
                            aria-label={`Your score for ${label}, out of ${MAX_SCORE}`}
                            className="w-16 rounded-md border border-slate-600/60 bg-slate-800/60 px-2 py-1 text-right text-base text-slate-100 placeholder:text-slate-500 focus:border-amber-400/60 focus:outline-none sm:text-sm"
                        />
                        <span className="whitespace-nowrap normal-case">/ {MAX_SCORE}</span>
                    </label>

                    {inherited && (
                        <p className="min-w-0 text-xs italic text-slate-500">
                            {entry.score.trim() === ''
                                ? `Showing ${inherited}.`
                                : `Overrides ${inherited}.`}
                        </p>
                    )}
                </div>

                <textarea
                    rows={2}
                    maxLength={LIMITS.entryDescription}
                    value={entry.description}
                    onChange={(e) => onNoteChange(e.target.value)}
                    placeholder="Why this one? (optional, Markdown)"
                    className={ROW_FIELD_CLASS}
                />

                {/* Most films on a list are ones the club never watched, so all
                    the row has to work with is whatever OMDB had — often a
                    poster of the wrong edition, sometimes none at all, and never
                    a still. These two fields fix each half of that: wide art to
                    wash behind the row, and the poster beside it. The thumbnail
                    on the first is the only place a dead link shows as dead —
                    on the list itself the art is faded far too low to tell one
                    from a dark frame. */}
                <div className="flex items-center gap-2">
                    <input
                        type="url"
                        inputMode="url"
                        maxLength={IMAGE_URL_LIMIT}
                        value={entry.image}
                        onChange={(e) => onImageChange(e.target.value)}
                        placeholder="https://… background image (optional)"
                        aria-label={`Background image for ${label}`}
                        className={ROW_FIELD_CLASS}
                    />
                    <ImageUrlPreview url={entry.image} className="h-9 w-14" />
                </div>

                {/* The poster needs no preview of its own: the row's thumb above
                    is already showing this URL at the size and crop it will
                    have, and falls back the moment the field is cleared. */}
                <input
                    type="url"
                    inputMode="url"
                    maxLength={IMAGE_URL_LIMIT}
                    value={entry.posterImage}
                    onChange={(e) => onPosterImageChange(e.target.value)}
                    placeholder="https://… poster (optional)"
                    aria-label={`Poster for ${label}`}
                    className={ROW_FIELD_CLASS}
                />

                {/* The trailer the row's play button opens. Blank means the
                    film's own, which for most list films is whatever TMDb had;
                    the checkbox is the separate answer "none at all", so hiding
                    a trailer doesn't cost the member the link they found. */}
                <input
                    type="text"
                    inputMode="url"
                    maxLength={TRAILER_URL_LIMIT}
                    value={entry.trailer}
                    onChange={(e) => onTrailerChange(e.target.value)}
                    disabled={entry.hideTrailer}
                    placeholder="https://youtube.com/watch?v=… trailer (optional)"
                    aria-label={`Trailer for ${label}`}
                    className={`${ROW_FIELD_CLASS} disabled:opacity-50`}
                />
                <label className="flex items-center gap-2 text-xs text-slate-500">
                    <input
                        type="checkbox"
                        checked={entry.hideTrailer}
                        onChange={(e) => onHideTrailerChange(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-800/60 accent-amber-500"
                    />
                    No trailer for {label}
                </label>
            </div>
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
                image: '',
                posterImage: '',
                trailer: '',
                hideTrailer: false,
                score: '',
                // A film just added may already be one the member has watched or
                // scored with the club, and the row should say so from the
                // moment it appears.
                ...inheritedScoreFor(hit.imdbID, owner ?? member ?? undefined),
                title: hit.title,
                year: hit.year,
                poster: hit.poster,
            },
        ]);
    };

    /** Replaces one row's editable fields, leaving the rest of the draft alone. */
    const patchEntry = (imdbID: string, patch: Partial<DraftEntry>) =>
        mutate(entries.map((entry) => (entry.imdbID === imdbID ? { ...entry, ...patch } : entry)));

    /** The arrow controls' half of reordering — a swap with the neighbour. */
    const moveEntry = (index: number, direction: -1 | 1) => {
        const target = index + direction;
        if (target < 0 || target >= entries.length) return;
        const next = [...entries];
        [next[index], next[target]] = [next[target], next[index]];
        mutate(next);
    };

    const handleSave = async () => {
        const trimmedName = name.trim();
        if (trimmedName === '') {
            setSaveError('A list needs a name.');
            return;
        }

        // Checked here rather than on every keystroke: a half-typed URL is not a
        // mistake yet, and the row it belongs to is named in the message so a
        // long list doesn't turn into a hunt.
        const images = new Map<string, string | null>();
        const posterImages = new Map<string, string | null>();
        const trailerKeys = new Map<string, string | null>();
        const scores = new Map<string, number | null>();
        for (const entry of entries) {
            const label = entry.title ?? entry.imdbID;

            const parsed = parseImageUrl(entry.image);
            if ('error' in parsed) {
                setSaveError(`${label}, background image: ${parsed.error}`);
                return;
            }
            images.set(entry.imdbID, parsed.value);

            const parsedPoster = parseImageUrl(entry.posterImage);
            if ('error' in parsedPoster) {
                setSaveError(`${label}, poster: ${parsedPoster.error}`);
                return;
            }
            posterImages.set(entry.imdbID, parsedPoster.value);

            const parsedTrailer = parseTrailerLink(entry.trailer);
            if ('error' in parsedTrailer) {
                setSaveError(`${label}, trailer: ${parsedTrailer.error}`);
                return;
            }
            trailerKeys.set(entry.imdbID, parsedTrailer.value);

            const score = parseScoreField(entry.score);
            if ('error' in score) {
                setSaveError(`${label}: ${score.error}`);
                return;
            }
            scores.set(entry.imdbID, score.score);
        }

        const input: ListInput = {
            name: trimmedName,
            description: description.trim() === '' ? null : description.trim(),
            ranked,
            entries: entries.map((entry) => ({
                imdbID: entry.imdbID,
                description: entry.description.trim() === '' ? null : entry.description.trim(),
                image: images.get(entry.imdbID) ?? null,
                posterImage: posterImages.get(entry.imdbID) ?? null,
                trailerKey: trailerKeys.get(entry.imdbID) ?? null,
                hideTrailer: entry.hideTrailer,
                score: scores.get(entry.imdbID) ?? null,
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
        if (!creating && listId) {
            navigate(`/lists/${listId}`, { replace: true });
            return;
        }
        const home = owner ?? member;
        navigate(home ? `/profile/${encodeURIComponent(home)}` : '/about', { replace: true });
    };

    const handleDelete = async () => {
        if (!listId) return;
        setSaving(true);
        setSaveError(null);
        try {
            await withToken((token) => deleteList(token, listId));
            touched.current = false;
            recordWrite('list', writeKeys.list(listId), null);
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

                {status !== 'signed-in' ? (
                    <p className="text-sm text-slate-400">
                        Sign in from the menu, with the Google account you gave the club, to build
                        your lists.
                    </p>
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
                                                mutate(
                                                    entries.filter(
                                                        (candidate) =>
                                                            candidate.imdbID !== entry.imdbID
                                                    )
                                                )
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
