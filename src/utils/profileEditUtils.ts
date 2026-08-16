import type { ProfilePatch } from '../api/clubApi';
import type { InterviewItem, TeamMember } from '../types/team';
import { parseImageUrl, parseProfileImageUrl } from './imageUrl';

/**
 * The pure half of the profile editor: what `club.json` holds for a member,
 * what they typed, and the difference between the two.
 *
 * Same shape as the rating and watch-log editors, and for the same reasons —
 * the patch carries only what actually changed, because a no-op save costs a
 * commit and a full Pages build. The wrinkle here is the interview, which is a
 * list rather than a field: it can't be merged question by question, so it goes
 * whole or not at all, and "changed" is a comparison of two arrays.
 */

/** The worker's caps, mirrored so a mistake is caught in the form. */
export const TITLE_LIMIT = 80;
export const BIO_LIMIT = 4000;
export const QUESTION_LIMIT = 300;
export const ANSWER_LIMIT = 4000;
export const INTERVIEW_LIMIT = 40;

/** The fields a member may set, normalized to what the worker stores. */
export interface ProfileValues {
    title: string;
    bio: string;
    url: string | null;
    image: string | null;
    interview: InterviewItem[];
}

/**
 * One interview row as the form holds it.
 *
 * The id is the row's React key and exists only in the browser. Index keys
 * would do until a member removes or moves a row, at which point every input
 * below it inherits the previous row's DOM node — and with it the focus and the
 * caret position of a field they weren't editing.
 */
export interface InterviewRow {
    id: string;
    question: string;
    answer: string;
}

/** The same fields as form state; every input is a string, empty for "unset". */
export interface ProfileFormValues {
    title: string;
    bio: string;
    url: string;
    image: string;
    interview: InterviewRow[];
}

// Monotonic rather than random: nothing persists these, they only have to be
// unique within one open editor, and `crypto.randomUUID` isn't everywhere.
let rowCounter = 0;
export const newInterviewRow = (question = '', answer = ''): InterviewRow => ({
    id: `interview-${++rowCounter}`,
    question,
    answer,
});

/** The stored fields of a member, dropping the ones no member may edit. */
export const toProfileValues = (member: TeamMember): ProfileValues => ({
    title: member.title ?? '',
    bio: member.bio ?? '',
    // Absent and blank are the same thing to the form; the worker is what turns
    // a cleared field back into an absent one.
    url: member.url?.trim() ? member.url : null,
    image: member.image?.trim() ? member.image : null,
    interview: member.interview ?? [],
});

export const toProfileForm = (values: ProfileValues): ProfileFormValues => ({
    title: values.title,
    bio: values.bio,
    url: values.url ?? '',
    image: values.image ?? '',
    interview: values.interview.map((item) => newInterviewRow(item.question, item.answer)),
});

/** Two interviews are the same when their questions and answers are, in order. */
export const sameInterview = (a: InterviewItem[], b: InterviewItem[]): boolean =>
    a.length === b.length &&
    a.every(
        (item, index) => item.question === b[index].question && item.answer === b[index].answer
    );

/**
 * Whether the form still matches what was seeded into it. Compared on the typed
 * text rather than the parsed values, so a half-typed URL still counts as an
 * edit worth keeping — the same rule the rating editor's dirty check uses.
 */
export const sameProfileForm = (a: ProfileFormValues, b: ProfileFormValues): boolean =>
    a.title === b.title &&
    a.bio === b.bio &&
    a.url === b.url &&
    a.image === b.image &&
    a.interview.length === b.interview.length &&
    a.interview.every(
        (row, index) =>
            row.question === b.interview[index].question && row.answer === b.interview[index].answer
    );

export type ProfileParseResult = { values: ProfileValues } | { error: string };

/**
 * Parses the form with the same rules the worker applies, so a mistake is
 * caught while the member is still looking at the field rather than after a
 * round trip. The worker validates again regardless — this is convenience, not
 * trust.
 */
export function parseProfileForm(form: ProfileFormValues): ProfileParseResult {
    const title = form.title.trim();
    if (title.length > TITLE_LIMIT) {
        return { error: `Your title is ${title.length} characters; the limit is ${TITLE_LIMIT}.` };
    }

    const bio = form.bio.trim();
    if (bio.length > BIO_LIMIT) {
        return { error: `Your bio is ${bio.length} characters; the limit is ${BIO_LIMIT}.` };
    }

    // Both links are URLs, but only the image may also be a site path — so they
    // get different parsers and have to name themselves in the message.
    const image = parseProfileImageUrl(form.image);
    if ('error' in image) return { error: `Profile picture: ${image.error}` };

    const url = parseImageUrl(form.url);
    if ('error' in url) return { error: `Link: ${url.error}` };

    const interview: InterviewItem[] = [];
    for (const row of form.interview) {
        const question = row.question.trim();
        const answer = row.answer.trim();

        // An empty pair is the row the editor leaves at the bottom; saving
        // shouldn't make the member tidy it away first.
        if (question === '' && answer === '') continue;
        if (question === '') return { error: 'One of your answers has no question above it.' };
        if (answer === '')
            return { error: `"${question}" needs an answer, or clear the question.` };
        if (question.length > QUESTION_LIMIT) {
            return {
                error: `A question is ${question.length} characters; the limit is ${QUESTION_LIMIT}.`,
            };
        }
        if (answer.length > ANSWER_LIMIT) {
            return {
                error: `An answer is ${answer.length} characters; the limit is ${ANSWER_LIMIT}.`,
            };
        }

        interview.push({ question, answer });
    }

    if (interview.length > INTERVIEW_LIMIT) {
        return { error: `An interview holds at most ${INTERVIEW_LIMIT} questions.` };
    }

    return { values: { title, bio, url: url.value, image: image.value, interview } };
}

/**
 * The fields that actually changed, and nothing else. An empty result means
 * there is nothing to save — the worker rejects a patch with no recognized
 * field, and a save that quietly committed nothing would look like it worked.
 */
export function buildProfilePatch(next: ProfileValues, baseline: ProfileValues): ProfilePatch {
    const patch: ProfilePatch = {};
    if (next.title !== baseline.title) patch.title = next.title;
    if (next.bio !== baseline.bio) patch.bio = next.bio;
    if (next.url !== baseline.url) patch.url = next.url;
    if (next.image !== baseline.image) patch.image = next.image;
    if (!sameInterview(next.interview, baseline.interview)) patch.interview = next.interview;
    return patch;
}
