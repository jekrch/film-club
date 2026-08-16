import type { WatchedPatch } from '../api/clubApi';
import type { WatchedEntry } from '../types/watched';
import { parseImageUrl } from './imageUrl';
import { parseRatingForm, type RatingFormValues } from './ratingEditUtils';

/**
 * The pure half of the watch-log row editor: what is stored, what the member
 * typed, and the difference between the two.
 *
 * Score, qualifier, and review are parsed by {@link parseRatingForm} — the club
 * scores a film the same way whoever watched it, and two copies of the
 * one-decimal-place rule would eventually disagree. Only the date is new here.
 *
 * Unlike a rating override there is no presence semantics to preserve: nothing
 * else writes this file, so a cleared field is stored as an explicit `null`
 * rather than meaning "defer to the sheet". The patch still carries only what
 * changed, because a no-op save would otherwise cost a commit and a full Pages
 * build.
 */

/** The fields of an entry a member may set, normalized to what the worker stores. */
export interface WatchedValues {
    watchDate: string;
    score: number | null;
    scoreQualifier: string | null;
    blurb: string | null;
    /** Background art for the row; see {@link parseImageUrl}. */
    image: string | null;
    /** The member's own poster for the film; same rules, different frame. */
    posterImage: string | null;
}

/** The same fields as form state; every input is a string, empty for "unset". */
export interface WatchedFormValues extends RatingFormValues {
    /** `YYYY-MM-DD`, the value format of `<input type="date">`. */
    watchDate: string;
    image: string;
    posterImage: string;
}

/** Today in the *viewer's* timezone — the default date for a film being logged now. */
export const todayLocal = (): string => {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

export const toWatchedForm = (values: WatchedValues): WatchedFormValues => ({
    watchDate: values.watchDate,
    score: values.score === null ? '' : String(values.score),
    qualifier: values.scoreQualifier ?? '',
    blurb: values.blurb ?? '',
    image: values.image ?? '',
    posterImage: values.posterImage ?? '',
});

/** The stored fields of an entry, dropping the provenance the editor never touches. */
export const toWatchedValues = (entry: WatchedEntry): WatchedValues => ({
    watchDate: entry.watchDate,
    score: entry.score,
    scoreQualifier: entry.scoreQualifier,
    blurb: entry.blurb,
    // Absent on entries stored before the field existed, which reads the same
    // as one deliberately left blank.
    image: entry.image ?? null,
    posterImage: entry.posterImage ?? null,
});

export type WatchedParseResult = { values: WatchedValues } | { error: string };

/**
 * Parses the form with the same rules the worker applies, so a mistake is
 * caught while the member is still looking at the field rather than after a
 * round trip. The worker validates again regardless — this is convenience, not
 * trust.
 */
export function parseWatchedForm(form: WatchedFormValues): WatchedParseResult {
    const watchDate = form.watchDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(watchDate)) {
        return { error: 'Pick the date you watched it.' };
    }
    // `2026-02-31` parses as March 3rd rather than failing, so the round-trip
    // is what actually rejects a date that doesn't exist.
    const parsed = new Date(`${watchDate}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== watchDate) {
        return { error: `${watchDate} isn't a real date.` };
    }
    if (watchDate > todayLocal()) {
        return { error: "You can't log a film you haven't watched yet." };
    }

    const rating = parseRatingForm(form);
    if ('error' in rating) return rating;

    // Both URL fields are checked by the same rules, so the message has to say
    // which one failed — `parseImageUrl` only knows it was handed a bad link.
    const image = parseImageUrl(form.image);
    if ('error' in image) return { error: `Background image: ${image.error}` };

    const posterImage = parseImageUrl(form.posterImage);
    if ('error' in posterImage) return { error: `Poster: ${posterImage.error}` };

    return {
        values: { watchDate, ...rating.values, image: image.value, posterImage: posterImage.value },
    };
}

/**
 * The fields that actually changed, and nothing else. An empty result means
 * there is nothing to save — the worker rejects a patch with no recognized
 * field, and a save that quietly committed nothing would look like it worked.
 */
export function buildWatchedPatch(next: WatchedValues, baseline: WatchedValues): WatchedPatch {
    const patch: WatchedPatch = {};
    if (next.watchDate !== baseline.watchDate) patch.watchDate = next.watchDate;
    if (next.score !== baseline.score) patch.score = next.score;
    if (next.scoreQualifier !== baseline.scoreQualifier) patch.scoreQualifier = next.scoreQualifier;
    if (next.blurb !== baseline.blurb) patch.blurb = next.blurb;
    if (next.image !== baseline.image) patch.image = next.image;
    if (next.posterImage !== baseline.posterImage) patch.posterImage = next.posterImage;
    return patch;
}
