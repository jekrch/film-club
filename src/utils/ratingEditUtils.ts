import type { RatingOverride, RatingPatch } from '../api/clubApi';
import type { ClubRating } from '../types/film';

/**
 * The pure half of the rating editor: what the member currently has, what they
 * typed, and the difference between the two.
 *
 * This is where §8.7's presence semantics live, and they are the reason it is
 * worth separating from the component. A patch carries only the fields the
 * member actually changed — an absent key means "whatever the sheet says
 * stands", so sending back an untouched field would quietly freeze the sheet's
 * own value as a member override and make that spreadsheet cell inert forever.
 */

/** The three fields a member may set, normalized to what the worker stores. */
export interface RatingValues {
    score: number | null;
    scoreQualifier: string | null;
    blurb: string | null;
}

/** The same three as form state; every input is a string, empty for "unset". */
export interface RatingFormValues {
    score: string;
    qualifier: string;
    blurb: string;
}

/** The worker's cap on a review. */
export const BLURB_LIMIT = 4000;

export const toFormValues = (values: RatingValues): RatingFormValues => ({
    score: values.score === null ? '' : String(values.score),
    qualifier: values.scoreQualifier ?? '',
    blurb: values.blurb ?? '',
});

/**
 * What the member has right now, resolved field by field.
 *
 * The override wins wherever it has an opinion, and "has an opinion" is key
 * presence, not truthiness: a stored `blurb: null` is a deliberate blank, while
 * an absent `blurb` leaves the sheet's — already folded into `films.json` by
 * the last deploy — standing.
 */
export function baselineRating(
    override: RatingOverride | undefined,
    clubRating: ClubRating | undefined
): RatingValues {
    const pick = <K extends keyof RatingValues>(field: K): RatingValues[K] =>
        override && field in override
            ? ((override[field] ?? null) as RatingValues[K])
            : ((clubRating?.[field] ?? null) as RatingValues[K]);

    return {
        score: pick('score'),
        scoreQualifier: pick('scoreQualifier'),
        blurb: pick('blurb'),
    };
}

export type ParseResult = { values: RatingValues } | { error: string };

/**
 * Parses the form with the same rules the worker applies (§8.3), so a mistake
 * is caught while the member is still looking at the field rather than after a
 * round trip. The worker validates again regardless — this is convenience, not
 * trust.
 */
export function parseRatingForm(form: RatingFormValues): ParseResult {
    const rawScore = form.score.trim();
    let score: number | null = null;
    if (rawScore !== '') {
        const parsed = Number(rawScore);
        if (!Number.isFinite(parsed)) return { error: 'Score must be a number.' };
        if (parsed < 0 || parsed > 10) return { error: 'Score must be between 0 and 10.' };
        const tenths = parsed * 10;
        // 8.1 * 10 is 81.00000000000001 in binary floating point, so round-trip
        // rather than testing for an integer directly.
        if (Math.abs(tenths - Math.round(tenths)) > 1e-9) {
            return { error: 'Score can have at most one decimal place.' };
        }
        score = Math.round(tenths) / 10;
    }

    const qualifier = form.qualifier.trim().toLowerCase();
    if (qualifier !== '' && !/^[a-z]$/.test(qualifier)) {
        return { error: 'Qualifier must be a single letter, e.g. d for documentary.' };
    }

    const blurb = form.blurb.trim();
    if (blurb.length > BLURB_LIMIT) {
        return { error: `Review is ${blurb.length} characters; the limit is ${BLURB_LIMIT}.` };
    }

    return {
        values: {
            score,
            scoreQualifier: qualifier === '' ? null : qualifier,
            blurb: blurb === '' ? null : blurb,
        },
    };
}

/**
 * The fields that actually changed, and nothing else. An empty result means
 * there is nothing to save — the worker rejects a patch with no recognized
 * field, and a save that quietly committed nothing would look like it worked.
 */
export function buildRatingPatch(next: RatingValues, baseline: RatingValues): RatingPatch {
    const patch: RatingPatch = {};
    if (next.score !== baseline.score) patch.score = next.score;
    if (next.scoreQualifier !== baseline.scoreQualifier) patch.scoreQualifier = next.scoreQualifier;
    if (next.blurb !== baseline.blurb) patch.blurb = next.blurb;
    return patch;
}
