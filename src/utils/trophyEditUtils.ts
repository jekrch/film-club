import type { TrophyInput } from '../api/clubApi';
import type { Trophy } from '../types/trophy';

/**
 * The pure half of the trophy editor: what the form holds, and what the worker
 * would store for it.
 *
 * Small enough to look unnecessary, and separated for the same reason the rating
 * editor's half is: the rules here are the ones the worker will apply anyway
 * (`validateTrophyInput` in `worker/src/validate.ts`), and a member should learn
 * about a missing award name from the form rather than from a 400.
 */

/** The trophy fields as form state. Every input is a string; empty means unset. */
export interface TrophyFormValues {
    recipient: string;
    award: string;
    note: string;
}

/** The worker's caps, mirrored so the inputs can enforce them as you type. */
export const AWARD_LIMIT = 80;
export const NOTE_LIMIT = 300;

export const EMPTY_TROPHY_FORM: TrophyFormValues = { recipient: '', award: '', note: '' };

export const toTrophyForm = (trophy: Trophy): TrophyFormValues => ({
    recipient: trophy.recipient,
    award: trophy.award,
    note: trophy.note ?? '',
});

/** Field-by-field equality; the builders above return a fresh object every call. */
export const sameTrophyForm = (a: TrophyFormValues, b: TrophyFormValues): boolean =>
    a.recipient === b.recipient && a.award === b.award && a.note === b.note;

export type TrophyParseResult = { input: TrophyInput } | { error: string };

/**
 * Validates and normalizes what the member typed.
 *
 * Whitespace-only text collapses to `null` on the note, matching the worker's
 * `optionalText` — so a cleared field stores the same value as one never filled
 * in, and the diff doesn't churn between `""` and `null`.
 */
export function parseTrophyForm(form: TrophyFormValues): TrophyParseResult {
    const recipient = form.recipient.trim();
    if (recipient === '') return { error: 'Pick who the trophy goes to.' };

    const award = form.award.trim();
    if (award === '') return { error: 'Give the trophy a name.' };
    if (award.length > AWARD_LIMIT) {
        return { error: `A trophy name is at most ${AWARD_LIMIT} characters.` };
    }

    const note = form.note.trim();
    if (note.length > NOTE_LIMIT) {
        return { error: `A note is at most ${NOTE_LIMIT} characters.` };
    }

    return { input: { recipient, award, note: note === '' ? null : note } };
}

/**
 * Whether `member` may edit or withdraw an award.
 *
 * Mirrors `assertMayEditTrophy` in the worker, which is the copy that is
 * trusted; this one exists so the UI doesn't offer a button that would 403.
 * Note who is *not* here: the recipient. A trophy is the club's joke about
 * someone, and the person it lands on doesn't get to erase it.
 */
export const canEditTrophy = (
    trophy: Pick<Trophy, 'awardedBy'>,
    member: string | null,
    admin: boolean
): boolean => admin || (member !== null && trophy.awardedBy.toLowerCase() === member.toLowerCase());
