import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid';
import { PencilSquareIcon } from '@heroicons/react/24/outline';

import Button from '../common/Button';
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
import { BLURB_LIMIT } from '../../utils/ratingEditUtils';
import type { WatchedPatch } from '../../api/clubApi';

/** The scale the club scores on, which members use for their own watches too. */
const MAX_RATING = 9;

/** Poster height, shared with the date column so the two center on each other. */
const POSTER_HEIGHT = 'h-[4.5rem]';

const FIELD_CLASS =
    'w-full rounded-md border border-slate-600/60 bg-slate-800/60 px-3 py-2 text-slate-100 ' +
    'placeholder:text-slate-500 focus:border-blue-400/60 focus:outline-none';

interface WatchedFilmItemProps {
    entry: ResolvedWatchedEntry;
    /** True for the log's owner (or an admin), who gets the edit affordance. */
    canEdit: boolean;
    /** Saves a patch of the changed fields. Resolves when the write lands. */
    onSave: (imdbID: string, patch: WatchedPatch) => Promise<void>;
    onRemove: (imdbID: string) => Promise<void>;
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
const WatchedFilmItem: React.FC<WatchedFilmItemProps> = ({ entry, canEdit, onSave, onRemove }) => {
    const { clubFilm, title, year, poster, imdbID, watchDate, blurb } = entry;
    // A dead poster URL falls back to the empty frame rather than swapping
    // `src`, which can re-fire the handler forever. Same reasoning as
    // `RankedListItem`: cache-only films are OMDB rows nobody vetted.
    const [posterFailed, setPosterFailed] = useState(false);
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState<WatchedFormValues>(() => toWatchedForm(toWatchedValues(entry)));
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
        <div className="group rounded-xl border border-slate-600/30 bg-slate-700/25 p-3 transition-colors duration-200 hover:border-blue-500/25 hover:bg-slate-700/45 sm:p-4">
            <div className="flex items-start">
                {/* The date owns the band the rank numeral owns on a list row:
                    this log is ordered by when, not by how good. Sized to the
                    poster rather than the row so a long review can't drift it. */}
                <div
                    className={`flex ${POSTER_HEIGHT} w-16 flex-shrink-0 select-none flex-col items-center justify-center pr-2 text-center sm:w-24 sm:pr-3`}
                >
                    <time
                        dateTime={watchDate}
                        className="font-serif text-sm leading-tight tabular-nums text-slate-400 transition-colors duration-200 group-hover:text-blue-300/80 sm:text-base"
                    >
                        {formatWatchDate(watchDate)}
                    </time>
                </div>

                {wrapLink(
                    poster && !posterFailed ? (
                        <img
                            src={poster}
                            alt={`${displayTitle} poster`}
                            loading="lazy"
                            decoding="async"
                            className={`block ${POSTER_HEIGHT} w-12 rounded-md object-cover object-top shadow-sm shadow-black/40 ring-1 ring-slate-600/40 transition-opacity hover:opacity-80`}
                            onError={() => setPosterFailed(true)}
                        />
                    ) : (
                        <span
                            className={`flex ${POSTER_HEIGHT} w-12 items-center justify-center rounded-md bg-slate-800 text-[10px] uppercase tracking-widest text-slate-600 ring-1 ring-slate-600/40`}
                        >
                            ?
                        </span>
                    ),
                    'flex-shrink-0 block'
                )}

                <div className="ml-3 min-w-0 flex-grow sm:ml-4">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        {wrapLink(
                            <h5 className="truncate font-medium text-slate-200 transition-colors group-hover:text-slate-100">
                                {displayTitle}
                                {year && <span className="ml-1.5 font-normal text-slate-500">{year}</span>}
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

                        {entry.score !== null && (
                            <span
                                className="ml-auto flex-shrink-0 rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-xs ring-1 ring-inset ring-white/[0.06]"
                                title={`Their own rating: ${entry.score}/${MAX_RATING}`}
                            >
                                <span className={getRatingColorClass(entry.score)}>{entry.score}</span>
                                {entry.scoreQualifier && (
                                    <span className="text-slate-400">{entry.scoreQualifier}</span>
                                )}
                                <span className="text-slate-600">/{MAX_RATING}</span>
                            </span>
                        )}
                    </div>

                    {blurb && !editing && (
                        <div className="prose prose-sm prose-invert mt-1.5 max-w-none text-sm leading-relaxed text-slate-300">
                            <ReactMarkdown>{blurb}</ReactMarkdown>
                        </div>
                    )}
                </div>

                {canEdit && !editing && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={openEditor}
                        aria-label={`Edit ${displayTitle}`}
                        className="ml-2 flex-shrink-0 hover:text-blue-300"
                    >
                        <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
                    </Button>
                )}
            </div>

            {editing && (
                <div className="mt-4 space-y-4 border-t border-slate-700/60 pt-4">
                    <div className="flex flex-wrap gap-4">
                        <label className="block w-44">
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
                                Score
                            </span>
                            <input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                max={10}
                                step={0.1}
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
                            rows={3}
                            maxLength={BLURB_LIMIT}
                            value={form.blurb}
                            onChange={(e) => setForm({ ...form, blurb: e.target.value })}
                            disabled={busy}
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
                            disabled={busy}
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
                            <span className="ml-auto flex items-center gap-3 text-sm text-slate-400">
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
