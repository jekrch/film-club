import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid';
import { PencilSquareIcon } from '@heroicons/react/24/outline';

import Button from '../common/Button';
import Markdown from '../common/Markdown';
import ImageUrlPreview from '../common/ImageUrlPreview';
import RowFrameWash from '../common/RowFrameWash';
import TrailerButton from '../common/TrailerButton';
import EntryDetailsPanel, { EntryDetailsToggle } from './EntryDetailsPanel';
import { entryFrameImage } from '../../utils/frameSources';
import { getRatingColorClass } from '../../utils/ratingUtils';
import { formatWatchDate, type ResolvedWatchedEntry } from '../../utils/watchedUtils';
import {
    buildWatchedPatch,
    parseWatchedForm,
    toWatchedForm,
    toWatchedValues,
    todayLocal,
    type WatchedFormValues,
} from '../../utils/watchedEditUtils';
import { BLURB_LIMIT, MAX_SCORE, SCORE_STEP } from '../../utils/ratingEditUtils';
import { IMAGE_URL_LIMIT } from '../../utils/imageUrl';
import { TRAILER_URL_LIMIT } from '../../utils/youtube';
import type { WatchedPatch } from '../../api/clubApi';

/** The scale the club scores on, which members use for their own watches too. */
const MAX_RATING = MAX_SCORE;

/**
 * The poster's box, at a poster's own 2:3.
 *
 * It is the row's left anchor and is sized to be looked at. The date used to own
 * a band twice its width — 6rem of centered serif for "Aug 15, 2026", against a
 * 3rem poster — which spent the row's most valuable space on its least
 * interesting field. The date is now a caption over the title, where the profile
 * preview has always put it, and the poster has the room that band was using.
 *
 * Sized to be read as artwork rather than as an icon: 72x108 on a phone,
 * 88x132 from `sm` up. Both are exact 2:3, which is the one constraint here —
 * a poster off its own ratio either letterboxes or crops the title off the top.
 */
const POSTER_CLASS = 'h-27 w-18 sm:h-33 sm:w-22';

const FIELD_CLASS =
    'w-full rounded-md border border-slate-600/60 bg-slate-800/60 px-3 py-2 text-slate-100 ' +
    'placeholder:text-slate-500 focus:border-blue-400/60 focus:outline-none';

/**
 * The review is the only field in this editor anyone writes a paragraph into,
 * so it opens tall enough to hold one and drags taller from there. It stays a
 * little shorter than the same field on a film's page: this one sits inline in
 * a log, and the row it belongs to should still be visible above it.
 */
const REVIEW_CLASS = `${FIELD_CLASS} min-h-48 resize-y leading-relaxed`;

interface WatchedFilmItemProps {
    entry: ResolvedWatchedEntry;
    /** True for the log's owner (or an admin), who gets the edit affordance. */
    canEdit: boolean;
    /** Saves a patch of the changed fields. Resolves when the write lands. */
    onSave: (imdbID: string, patch: WatchedPatch) => Promise<void>;
    onRemove: (imdbID: string) => Promise<void>;
    /**
     * True for the row a link arrived at by name, which blooms a ring and lets
     * it fade — the arriving reader is scrolled here mid-log and needs to be
     * told which row that was, but nothing should look selected afterwards.
     */
    highlighted?: boolean;
}

/**
 * One dated row of a member's watch log: when they watched it, what they made
 * of it, and — for the owner — an editor for both.
 *
 * The club counterpart of this row is a film card on the films page; the
 * difference that matters is whose opinion the score is. Here it is one
 * person's, so it is never labelled an average and never drawn from
 * `clubRatings`, even when the club happens to have watched the same film.
 *
 * Where the row links depends on which side of the club divide the film falls:
 * one the club watched goes to its detail page (where the *club's* ratings
 * live), anything else goes out to IMDb, since a film with no club record has
 * no page on this site.
 */
const WatchedFilmItem: React.FC<WatchedFilmItemProps> = ({
    entry,
    canEdit,
    onSave,
    onRemove,
    highlighted = false,
}) => {
    const { clubFilm, title, year, poster, imdbID, watchDate, blurb } = entry;
    // The resolved key — theirs if they set one, the film's otherwise, null if
    // they hid it — never the raw override this row's editor writes.
    const trailerKey = entry.resolvedTrailerKey;
    const { details } = entry;
    const [detailsOpen, setDetailsOpen] = useState(false);
    const panelId = `log-details-${imdbID}`;
    // A dead poster URL falls back to the empty frame rather than swapping
    // `src`, which can re-fire the handler forever. Same reasoning as
    // `RankedListItem`: cache-only films are OMDB rows nobody vetted.
    const [posterFailed, setPosterFailed] = useState(false);
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState<WatchedFormValues>(() =>
        toWatchedForm(toWatchedValues(entry))
    );
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmingRemove, setConfirmingRemove] = useState(false);

    const displayTitle = title ?? 'Unknown film';
    const baseline = toWatchedValues(entry);

    const openEditor = () => {
        // Seed from the entry each time rather than keeping a stale draft: a
        // save that landed elsewhere on the page should be what shows here.
        setForm(toWatchedForm(baseline));
        setError(null);
        setConfirmingRemove(false);
        setEditing(true);
    };

    const handleSave = async () => {
        const parsed = parseWatchedForm(form);
        if ('error' in parsed) {
            setError(parsed.error);
            return;
        }

        const patch = buildWatchedPatch(parsed.values, baseline);
        if (Object.keys(patch).length === 0) {
            setEditing(false);
            return;
        }

        setBusy(true);
        setError(null);
        try {
            await onSave(imdbID, patch);
            setEditing(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Save failed.');
        } finally {
            setBusy(false);
        }
    };

    const handleRemove = async () => {
        setBusy(true);
        setError(null);
        try {
            await onRemove(imdbID);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Remove failed.');
            setBusy(false);
        }
    };

    const wrapLink = (children: React.ReactNode, className: string) =>
        clubFilm ? (
            <Link to={`/films/${imdbID}`} className={className}>
                {children}
            </Link>
        ) : (
            <a
                href={`https://www.imdb.com/title/${imdbID}/`}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
            >
                {children}
            </a>
        );

    return (
        // `relative` and `overflow-hidden` are the wash's doing: it lays itself
        // over the row and has to be clipped to the rounded corners. The blocks
        // below are `relative` so they stack above the art — a positioned
        // element paints over static siblings regardless of source order.
        <div
            className={`group relative overflow-hidden rounded-xl border border-slate-600/30 bg-slate-700/25 p-3 transition-colors duration-200 hover:border-blue-500/25 hover:bg-slate-700/45 sm:p-4${
                highlighted ? ' row-arrival' : ''
            }`}
        >
            {/* Not while the editor is open: the form is the whole row then, and
                art behind a date field and a textarea is just noise. */}
            {!editing && <RowFrameWash image={entryFrameImage(entry)} />}

            {/* A grid rather than a flex row, for the review's sake: on a wide
                screen it belongs beside the poster in the title's column, and on
                a phone that column is barely 200px, which turns a paragraph into
                a ribbon of three-word lines. Spanning the full width there is a
                change of placement, not of markup — which a flex row would need
                two copies of. */}
            <div className="relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-start">
                {wrapLink(
                    poster && !posterFailed ? (
                        <img
                            src={poster}
                            alt={`${displayTitle} poster`}
                            loading="lazy"
                            decoding="async"
                            className={`block ${POSTER_CLASS} rounded-md object-cover object-top shadow-sm shadow-black/40 ring-1 ring-slate-600/40 transition-opacity hover:opacity-80`}
                            onError={() => setPosterFailed(true)}
                        />
                    ) : (
                        <span
                            className={`flex ${POSTER_CLASS} items-center justify-center rounded-md bg-slate-800 text-[10px] uppercase tracking-widest text-slate-600 ring-1 ring-slate-600/40`}
                        >
                            ?
                        </span>
                    ),
                    'col-start-1 row-start-1 block sm:row-span-2'
                )}

                <div className="col-start-2 row-start-1 ml-3 min-w-0 sm:ml-4">
                    {/* The log is ordered by when, so the date leads the row —
                        but as a caption over the title rather than a column
                        beside it. Every row's is at the same place under the
                        same poster edge, which is what makes a date scannable;
                        the width it used to hold was never doing that work. */}
                    <time
                        dateTime={watchDate}
                        className="block text-xs uppercase tracking-widest tabular-nums text-slate-500 transition-colors duration-200 group-hover:text-blue-300/80"
                    >
                        {formatWatchDate(watchDate)}
                    </time>

                    <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        {wrapLink(
                            // Wraps on a phone rather than truncating: the title
                            // is what the row is, and a truncated one beside a
                            // poster leaves the reader guessing.
                            <h5 className="break-words font-medium text-slate-200 transition-colors group-hover:text-slate-100 sm:truncate">
                                {displayTitle}
                                {year && (
                                    <span className="ml-1.5 font-normal text-slate-500">
                                        {year}
                                    </span>
                                )}
                                {!clubFilm && (
                                    <ArrowTopRightOnSquareIcon
                                        className="ml-1.5 inline h-3 w-3 align-baseline text-slate-600"
                                        aria-hidden="true"
                                    />
                                )}
                            </h5>,
                            'min-w-0'
                        )}

                        {/* Marks the overlap explicitly. Without it a club film
                            in a personal log reads as a club record, which is
                            the one confusion this feature has to avoid. */}
                        {clubFilm && (
                            <span className="flex-shrink-0 rounded-md bg-amber-400/[0.07] px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-400/70 ring-1 ring-inset ring-amber-400/20">
                                Club film
                            </span>
                        )}

                        {/* Trailer and score travel together at the end of the
                            line, so the pair moves as one when the title wraps
                            — a badge carrying `ml-auto` on its own would jump to
                            the far edge of whatever row it landed on. */}
                        {(entry.score !== null || trailerKey !== null || details !== null) && (
                            <span className="ml-auto flex flex-shrink-0 items-center gap-1.5">
                                {trailerKey && (
                                    <TrailerButton trailerKey={trailerKey} title={displayTitle} />
                                )}

                                {entry.score !== null && (
                                    <span
                                        className="rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-xs ring-1 ring-inset ring-white/[0.06]"
                                        title={`Their own rating: ${entry.score}/${MAX_RATING}`}
                                    >
                                        <span className={getRatingColorClass(entry.score)}>
                                            {entry.score}
                                        </span>
                                        {entry.scoreQualifier && (
                                            <span className="text-slate-400">
                                                {entry.scoreQualifier}
                                            </span>
                                        )}
                                        <span className="text-slate-500">/{MAX_RATING}</span>
                                    </span>
                                )}

                                {/* Last in the cluster: the badges before it are
                                    labels, this is the one that acts on the row. */}
                                {details && (
                                    <EntryDetailsToggle
                                        isOpen={detailsOpen}
                                        onToggle={() => setDetailsOpen((open) => !open)}
                                        title={displayTitle}
                                        panelId={panelId}
                                    />
                                )}
                            </span>
                        )}
                    </div>
                </div>

                {canEdit && !editing && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={openEditor}
                        aria-label={`Edit ${displayTitle}`}
                        className="col-start-3 row-start-1 ml-2 hover:text-blue-300"
                    >
                        <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
                    </Button>
                )}

                {blurb && !editing && (
                    <div className="col-span-3 col-start-1 row-start-2 ml-3 mt-1.5 prose prose-sm prose-invert max-w-none text-sm leading-relaxed text-slate-300 sm:col-span-1 sm:col-start-2 sm:ml-4">
                        <Markdown>{blurb}</Markdown>
                    </div>
                )}
            </div>

            {/* Across the whole row rather than in the title's column: this is
                the film's own description, not the member's. Closed while the
                editor is open — the form is the row then. */}
            {details && detailsOpen && !editing && (
                <div className="relative">
                    <EntryDetailsPanel
                        details={details}
                        panelId={panelId}
                        title={displayTitle}
                        imdbID={imdbID}
                    />
                </div>
            )}

            {editing && (
                <div className="relative mt-4 space-y-4 border-t border-slate-700/60 pt-4">
                    {/* The date field takes the row on a phone; the two small
                        ones pair off underneath it rather than being wrapped one
                        per line by a `w-44` that leaves no room beside it. */}
                    <div className="flex flex-wrap gap-x-4 gap-y-3">
                        <label className="block w-full sm:w-44">
                            <span className="mb-1 block text-xs uppercase tracking-wider text-slate-500">
                                Watched
                            </span>
                            <input
                                type="date"
                                value={form.watchDate}
                                max={todayLocal()}
                                onChange={(e) => setForm({ ...form, watchDate: e.target.value })}
                                disabled={busy}
                                className={FIELD_CLASS}
                            />
                        </label>
                        <label className="block w-24">
                            <span className="mb-1 block text-xs uppercase tracking-wider text-slate-500">
                                Score / {MAX_RATING}
                            </span>
                            <input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                max={MAX_RATING}
                                step={SCORE_STEP}
                                value={form.score}
                                onChange={(e) => setForm({ ...form, score: e.target.value })}
                                disabled={busy}
                                placeholder="—"
                                className={FIELD_CLASS}
                            />
                        </label>
                        <label className="block w-24">
                            <span className="mb-1 block text-xs uppercase tracking-wider text-slate-500">
                                Qualifier
                            </span>
                            <input
                                type="text"
                                maxLength={1}
                                value={form.qualifier}
                                onChange={(e) => setForm({ ...form, qualifier: e.target.value })}
                                disabled={busy}
                                placeholder="d"
                                className={FIELD_CLASS}
                            />
                        </label>
                    </div>

                    <label className="block">
                        <span className="mb-1 block text-xs uppercase tracking-wider text-slate-500">
                            Review
                        </span>
                        <textarea
                            rows={8}
                            maxLength={BLURB_LIMIT}
                            value={form.blurb}
                            onChange={(e) => setForm({ ...form, blurb: e.target.value })}
                            disabled={busy}
                            placeholder="What did you make of it? Markdown works here."
                            className={REVIEW_CLASS}
                        />
                    </label>

                    {/* Two links, two jobs: one is washed in behind the row,
                        the other stands in for the poster beside it. They sit
                        together because a member fixing a film's artwork has no
                        reason to know which of the two they want until they see
                        both described. */}
                    <label className="block">
                        <span className="mb-1 block text-xs uppercase tracking-wider text-slate-500">
                            Background image
                        </span>
                        <div className="flex items-start gap-3">
                            <input
                                type="url"
                                inputMode="url"
                                maxLength={IMAGE_URL_LIMIT}
                                value={form.image}
                                onChange={(e) => setForm({ ...form, image: e.target.value })}
                                disabled={busy}
                                placeholder="https://… a still you'd rather see behind this row"
                                className={FIELD_CLASS}
                            />
                            <ImageUrlPreview url={form.image} className="h-10 w-16" />
                        </div>
                        <span className="mt-1 block text-xs text-slate-500">
                            Optional. Leave it blank to use the film's own artwork.
                        </span>
                    </label>

                    <label className="block">
                        <span className="mb-1 block text-xs uppercase tracking-wider text-slate-500">
                            Poster
                        </span>
                        <div className="flex items-start gap-3">
                            <input
                                type="url"
                                inputMode="url"
                                maxLength={IMAGE_URL_LIMIT}
                                value={form.posterImage}
                                onChange={(e) => setForm({ ...form, posterImage: e.target.value })}
                                disabled={busy}
                                placeholder="https://… a poster you'd rather see than this one"
                                className={FIELD_CLASS}
                            />
                            {/* Shaped like the poster it replaces, so a wide
                                still pasted in here shows what it would do to
                                the row before it is saved. */}
                            <ImageUrlPreview
                                url={form.posterImage}
                                className="h-16 w-11 object-top"
                            />
                        </div>
                        <span className="mt-1 block text-xs text-slate-500">
                            Optional. Leave it blank to use the film's own poster.
                        </span>
                    </label>

                    {/* The trailer the row's play button opens. Two controls
                        rather than one field: a blank link means "whatever
                        trailer the film has", which is not the same answer as
                        "none" — and a member who has said none should keep the
                        link they had for the day they change their mind, which
                        is why hiding disables the field instead of clearing it. */}
                    <div>
                        <label className="block">
                            <span className="mb-1 block text-xs uppercase tracking-wider text-slate-500">
                                Trailer
                            </span>
                            <input
                                type="text"
                                inputMode="url"
                                maxLength={TRAILER_URL_LIMIT}
                                value={form.trailer}
                                onChange={(e) => setForm({ ...form, trailer: e.target.value })}
                                disabled={busy || form.hideTrailer}
                                placeholder="https://youtube.com/watch?v=… a trailer you'd rather play"
                                className={`${FIELD_CLASS} disabled:opacity-50`}
                            />
                        </label>
                        <label className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                            <input
                                type="checkbox"
                                checked={form.hideTrailer}
                                onChange={(e) =>
                                    setForm({ ...form, hideTrailer: e.target.checked })
                                }
                                disabled={busy}
                                className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-800/60 accent-blue-500"
                            />
                            No trailer on this row
                        </label>
                        <span className="mt-1 block text-xs text-slate-500">
                            {form.hideTrailer
                                ? 'Hidden. Your link is kept for whenever you turn it back on.'
                                : "Optional. Leave it blank to use the film's own trailer."}
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        {/* Full width on a phone: at its natural width it shares
                            a line with Cancel and, once confirmed, with Remove —
                            a thumb's width from the two destructive outcomes. */}
                        <Button
                            type="button"
                            variant="solid"
                            size="sm"
                            accent="blue"
                            onClick={() => void handleSave()}
                            disabled={busy}
                            className="w-full sm:w-auto"
                        >
                            {busy ? 'Saving…' : 'Save'}
                        </Button>
                        <Button
                            type="button"
                            variant="link"
                            size="sm"
                            onClick={() => setEditing(false)}
                            disabled={busy}
                            className="text-slate-400 hover:text-slate-200"
                        >
                            Cancel
                        </Button>

                        {!confirmingRemove ? (
                            <Button
                                type="button"
                                variant="link"
                                size="sm"
                                accent="rose"
                                onClick={() => setConfirmingRemove(true)}
                                disabled={busy}
                                className="ml-auto"
                            >
                                Remove
                            </Button>
                        ) : (
                            <span className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400 sm:ml-auto sm:w-auto">
                                Drop {displayTitle} from your log?
                                <Button
                                    type="button"
                                    variant="link"
                                    size="sm"
                                    accent="rose"
                                    onClick={() => void handleRemove()}
                                    disabled={busy}
                                >
                                    Remove
                                </Button>
                                <Button
                                    type="button"
                                    variant="link"
                                    size="sm"
                                    onClick={() => setConfirmingRemove(false)}
                                    disabled={busy}
                                    className="text-slate-400 hover:text-slate-200"
                                >
                                    Cancel
                                </Button>
                            </span>
                        )}
                    </div>

                    {error && <p className="text-sm text-rose-300">{error}</p>}
                </div>
            )}
        </div>
    );
};

export default WatchedFilmItem;
