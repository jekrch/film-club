import React from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { Bars3Icon, ChevronDownIcon, ChevronUpIcon, TrashIcon } from '@heroicons/react/24/outline';

import Button from '../common/Button';
import ImageUrlPreview from '../common/ImageUrlPreview';
import {
    draftLabel,
    draftRowPoster,
    inheritedScoreHint,
    LIST_LIMITS,
    type DraftEntry,
} from '../../utils/listEditUtils';
import { IMAGE_URL_LIMIT } from '../../utils/imageUrl';
import { TRAILER_URL_LIMIT } from '../../utils/youtube';
import { MAX_SCORE, SCORE_STEP } from '../../utils/ratingEditUtils';

/**
 * One editable row of the list editor, split out of `ListEditorPage` because it
 * is a self-contained ~250 lines of form against a page that is otherwise draft
 * state and save lifecycle.
 *
 * It owns no state: every field is a controlled input over the {@link DraftEntry}
 * it is handed, and every change goes back up as a callback. The page holds the
 * whole draft because a list is saved whole (§8.4), so a row that kept its own
 * copy would only be a second source of truth to reconcile.
 *
 * Its declared class strings are its own rather than shared: the field styling
 * is copied in each of this codebase's editors, and unifying it is a change to
 * five components, not to this one.
 */

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
    const label = draftLabel(entry);
    // What the row will actually show once saved, kept live as the field is
    // typed in — including back to the film's own poster when it is cleared.
    const rowPoster = draftRowPoster(entry);
    const inherited = inheritedScoreHint(entry);

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
                        <p className="min-w-0 text-xs italic text-slate-500">{inherited}</p>
                    )}
                </div>

                <textarea
                    rows={2}
                    maxLength={LIST_LIMITS.entryDescription}
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

export default EntryRow;
