import React, { useState } from 'react';

import Button from '../common/Button';
import ImageUrlPreview from '../common/ImageUrlPreview';
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
import type { WatchedEntry } from '../../types/watched';

/** The scale the club scores on, which members use for their own watches too. */
const MAX_RATING = MAX_SCORE;

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

interface WatchedEntryEditorProps {
    entry: WatchedEntry;
    /** The film's display title, for the remove confirmation. */
    title: string;
    /** Saves a patch of the changed fields. Resolves when the write lands. */
    onSave: (patch: WatchedPatch) => Promise<void>;
    /** Resolves once the entry is gone; the caller takes the editor away. */
    onRemove: () => Promise<void>;
    /** Cancel, or a save that landed (or had nothing to send). */
    onClose: () => void;
    className?: string;
}

/**
 * The form for one watch-log entry: date, score, review, artwork, trailer, and
 * removing it altogether.
 *
 * Its own component so the log's row and the club's wall edit an entry with the
 * same fields and the same rules. Seeded from the entry when it mounts rather
 * than keeping a draft between openings: a save that landed elsewhere on the
 * page should be what shows the next time it opens.
 */
const WatchedEntryEditor: React.FC<WatchedEntryEditorProps> = ({
    entry,
    title,
    onSave,
    onRemove,
    onClose,
    className = '',
}) => {
    const baseline = toWatchedValues(entry);
    const [form, setForm] = useState<WatchedFormValues>(() => toWatchedForm(baseline));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmingRemove, setConfirmingRemove] = useState(false);

    const handleSave = async () => {
        const parsed = parseWatchedForm(form);
        if ('error' in parsed) {
            setError(parsed.error);
            return;
        }

        const patch = buildWatchedPatch(parsed.values, baseline);
        if (Object.keys(patch).length === 0) {
            onClose();
            return;
        }

        setBusy(true);
        setError(null);
        try {
            await onSave(patch);
            onClose();
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
            await onRemove();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Remove failed.');
            setBusy(false);
        }
    };

    return (
        <div className={`space-y-4 ${className}`}>
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
                    <ImageUrlPreview url={form.posterImage} className="h-16 w-11 object-top" />
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
                        onChange={(e) => setForm({ ...form, hideTrailer: e.target.checked })}
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
                    onClick={onClose}
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
                        Drop {title} from your log?
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
    );
};

export default WatchedEntryEditor;
