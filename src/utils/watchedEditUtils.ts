import type { WatchedPatch } from '../api/clubApi';
import type { WatchedEntry } from '../types/watched';
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

/** The four fields of an entry a member may set, normalized to what the worker stores. */
export interface WatchedValues {
    watchDate: string;
    score: number | null;
    scoreQualifier: string | null;
    blurb: string | null;
}

/** The same four as form state; every input is a string, empty for "unset". */
export interface WatchedFormValues extends RatingFormValues {
    /** `YYYY-MM-DD`, the value format of `<input type="date">`. */
    watchDate: string;
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
});

/** The stored fields of an entry, dropping the provenance the editor never touches. */
export const toWatchedValues = (entry: WatchedEntry): WatchedValues => ({
    watchDate: entry.watchDate,
    score: entry.score,
    scoreQualifier: entry.scoreQualifier,
    blurb: entry.blurb,
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

    return { values: { watchDate, ...rating.values } };
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
    return patch;
}
