/**
 * Payload validation — the trust boundary from §8.3 of the lists plan.
 *
 * An authenticated member is trusted to edit *their own contributions*, not to
 * write files. Nothing here reads the network or the environment: every export
 * is a pure function of its arguments, so the whole boundary is unit-testable
 * and the router can't accidentally skip half of it.
 *
 * Two rules run through all of it:
 *
 * - **Unknown fields are dropped, never merged.** Every function rebuilds the
 *   record from named fields, so what gets committed is always exactly the
 *   documented shape no matter what the client sent.
 * - **The caller owns what they write.** Ownership is checked against the
 *   member resolved from the ID token, never against anything in the body.
 */

import { badRequest, forbidden } from './errors';
import type { FilmListEntry, InterviewItem } from './types';

/** IMDb ids as they appear in `films.json`. */
export const IMDB_ID_PATTERN = /^tt\d{7,9}$/;

/**
 * The top of the club's scale: every score on the site is out of 9, whether it
 * is a club rating, a personal watch, or a pick on a list. Mirrored on the site
 * as `MAX_SCORE` in `src/utils/ratingEditUtils.ts`, which catches a typo in the
 * form; this is the copy that is trusted.
 */
export const MAX_SCORE = 9;

/**
 * Sanity bounds on what one commit may contain, not technical limits. The
 * worker makes no per-film network call on save (§8.6), so a long list costs it
 * nothing — these exist to keep a single request from writing an absurd file.
 */
export const LIMITS = {
    body: 32 * 1024,
    listName: 80,
    listDescription: 1000,
    entryDescription: 500,
    entries: 100,
    blurb: 4000,
    /** A URL, not an image — nothing here fetches what it points at. */
    imageUrl: 500,
    /** Films in one member's watch log. A log grows for years; a list does not. */
    watched: 2000,
    /** A member's role line under their name, e.g. "Filmmaker & Director". */
    title: 80,
    /** The profile bio. Markdown, and the longest prose the site asks anyone for. */
    bio: 4000,
    interviewQuestion: 300,
    interviewAnswer: 4000,
    /** Questions on one interview. Long enough that nobody will meet it. */
    interviewItems: 40,
} as const;

/** Fields a member may set on their own rating. Anything else in a body is ignored. */
const RATING_FIELDS = ['score', 'scoreQualifier', 'blurb'] as const;
type RatingField = (typeof RATING_FIELDS)[number];

/**
 * A partial rating update. Presence is the payload: a key that is absent is left
 * to the sheet, an explicit `null` is a deliberate blank. `PUT …/rating` is
 * therefore a field-level merge, which is what lets a member fix their score
 * without wiping a blurb the sheet supplied (§8.7).
 */
export type RatingPatch = Partial<Record<RatingField, number | string | null>> & {
    score?: number | null;
    scoreQualifier?: string | null;
    blurb?: string | null;
};

/** The list fields a client supplies. `id` and `rank` are the worker's to assign. */
export interface ListInput {
    name: string;
    description: string | null;
    /** Whether the order renders numbered. Always stored, defaulting to true. */
    ranked: boolean;
    entries: FilmListEntry[];
}

function asRecord(body: unknown, what: string): Record<string, unknown> {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
        throw badRequest(`${what}: expected a JSON object`);
    }
    return body as Record<string, unknown>;
}

/**
 * Normalizes a text field to a trimmed string or `null`.
 *
 * Empty and whitespace-only text collapses to `null` so a cleared textarea
 * stores the same value as one that was never filled in — otherwise the site
 * would render an empty Markdown block and the diff would show `""` vs `null`
 * churn.
 */
function optionalText(value: unknown, max: number, field: string): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') throw badRequest(`${field}: expected a string or null`);
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.length > max) {
        throw badRequest(`${field}: ${trimmed.length} characters exceeds the ${max} limit`);
    }
    return trimmed;
}

/**
 * A member-supplied image URL for a row's background art, or `null` to clear it.
 *
 * `https` only. The site is served over HTTPS, so an `http` image is blocked as
 * mixed content — it would commit cleanly and then render as nothing, which is
 * the worst of the available failures. Nothing here fetches the URL: it is
 * stored verbatim and ends up as an `<img src>`, so what matters is that the
 * browser can load it, not that it resolves today.
 *
 * The site checks the same rules before saving (`parseImageUrl` in
 * `src/utils/imageUrl.ts`) so a typo is caught in the form; this is the copy
 * that is actually trusted.
 */
export function validateImageUrl(value: unknown, field = 'image'): string | null {
    const text = optionalText(value, LIMITS.imageUrl, field);
    if (text === null) return null;

    let parsed: URL;
    try {
        parsed = new URL(text);
    } catch {
        throw badRequest(`${field}: expected a full URL starting with https://`);
    }
    if (parsed.protocol !== 'https:') {
        throw badRequest(`${field}: must be an https:// URL`);
    }
    return text;
}

/**
 * A member's own avatar, which unlike every other image field on the site may
 * also be a path into the repo's own `public/images`.
 *
 * That exception is not a nicety: all six profiles currently point at
 * `/images/andy.jpg` and the like, and a validator that took https URLs only
 * would reject every member's existing image the first time they touched their
 * bio. A path must be site-absolute and single-slashed — `//evil.example` is a
 * protocol-relative URL to another origin, not a local file, and `..` has no
 * business in a stored `<img src>`.
 */
export function validateProfileImage(value: unknown, field = 'image'): string | null {
    const text = optionalText(value, LIMITS.imageUrl, field);
    if (text === null) return null;

    if (text.startsWith('/')) {
        if (text.startsWith('//') || text.includes('..')) {
            throw badRequest(`${field}: expected a path like /images/andy.jpg`);
        }
        return text;
    }
    return validateImageUrl(text, field);
}

/**
 * The optional link under a member's bio — a personal site, a Letterboxd
 * profile. `https` for the same reason images are: the page is served over it.
 */
export function validateProfileLink(value: unknown, field = 'url'): string | null {
    const text = optionalText(value, LIMITS.imageUrl, field);
    if (text === null) return null;

    let parsed: URL;
    try {
        parsed = new URL(text);
    } catch {
        throw badRequest(`${field}: expected a full URL starting with https://`);
    }
    if (parsed.protocol !== 'https:') throw badRequest(`${field}: must be an https:// URL`);
    return text;
}

/**
 * The interview, replaced wholesale rather than merged per question.
 *
 * A row blank on both sides is dropped, so an editor that keeps an empty pair at
 * the end doesn't have to strip it before saving. A row with only one side
 * filled is an error instead: it is the shape of a half-finished edit, and
 * silently discarding an answer someone typed is the one outcome worth refusing.
 */
export function validateInterview(value: unknown, field = 'interview'): InterviewItem[] {
    if (value === null || value === undefined) return [];
    if (!Array.isArray(value)) throw badRequest(`${field}: expected an array`);
    if (value.length > LIMITS.interviewItems) {
        throw badRequest(`${field}: ${value.length} questions exceeds the ${LIMITS.interviewItems} limit`);
    }

    const items: InterviewItem[] = [];
    value.forEach((rawItem, index) => {
        const item = asRecord(rawItem, `${field}[${index}]`);
        const question = optionalText(
            item.question,
            LIMITS.interviewQuestion,
            `${field}[${index}].question`
        );
        const answer = optionalText(item.answer, LIMITS.interviewAnswer, `${field}[${index}].answer`);

        if (question === null && answer === null) return;
        if (question === null) throw badRequest(`${field}[${index}].question: an answer needs a question`);
        if (answer === null) throw badRequest(`${field}[${index}].answer: a question needs an answer`);

        items.push({ question, answer });
    });

    return items;
}

/**
 * What a member may change about themselves.
 *
 * `name` is absent deliberately and permanently: it is the key every rating,
 * list, and watch log in the repo joins on, so renaming through this endpoint
 * would orphan a member's entire history. `queue` and `color` are absent for a
 * softer reason — the selection rotation and the chart palette are club-wide
 * settings that happen to be stored per member.
 */
const PROFILE_FIELDS = ['title', 'bio', 'url', 'image', 'interview'] as const;

/**
 * A partial profile update, with the same merge semantics as the other patches:
 * only the keys the body carried are touched, so saving an interview leaves the
 * bio alone. `interview` is the exception to field-level merging *within* a
 * field — it arrives as the whole array or not at all.
 */
export interface ProfilePatch {
    title?: string;
    bio?: string;
    url?: string | null;
    image?: string | null;
    interview?: InterviewItem[];
}

/**
 * Builds a profile patch, keeping only the fields the body actually carried.
 *
 * `title` and `bio` normalize to `''` rather than `null` when cleared: both are
 * required strings in `club.json`, and the site renders them unconditionally.
 * `url` and `image` are optional there, so a cleared one is `null` and the
 * handler drops the key entirely.
 */
export function validateProfilePatch(body: unknown): ProfilePatch {
    const raw = asRecord(body, 'profile');
    const patch: ProfilePatch = {};

    if ('title' in raw) patch.title = optionalText(raw.title, LIMITS.title, 'title') ?? '';
    if ('bio' in raw) patch.bio = optionalText(raw.bio, LIMITS.bio, 'bio') ?? '';
    if ('url' in raw) patch.url = validateProfileLink(raw.url);
    if ('image' in raw) patch.image = validateProfileImage(raw.image);
    if ('interview' in raw) patch.interview = validateInterview(raw.interview);

    if (Object.keys(patch).length === 0) {
        throw badRequest(`profile: nothing to update (expected one of ${PROFILE_FIELDS.join(', ')})`);
    }
    return patch;
}

/** Validates an IMDb id from a URL path or a list entry. */
export function validateImdbId(value: unknown, field = 'imdbID'): string {
    if (typeof value !== 'string' || !IMDB_ID_PATTERN.test(value)) {
        throw badRequest(`${field}: expected an IMDb id like tt0107653`);
    }
    return value;
}

/**
 * Scores are numbers in 0–{@link MAX_SCORE} with at most one decimal place.
 *
 * The sheet path tolerates unparseable cells by storing them verbatim; the
 * worker deliberately does not — it only ever emits values that path would have
 * produced, so `films.json` stays uniform whichever writer filled a row.
 */
function validateScore(value: unknown, field = 'score'): number | null {
    if (value === null) return null;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw badRequest(`${field}: expected a number or null`);
    }
    if (value < 0 || value > MAX_SCORE) {
        throw badRequest(`${field}: must be between 0 and ${MAX_SCORE}`);
    }
    const tenths = value * 10;
    // Binary floating point means 8.1 * 10 is 81.00000000000001, so round-trip
    // rather than testing for an integer directly.
    if (Math.abs(tenths - Math.round(tenths)) > 1e-9) {
        throw badRequest(`${field}: at most one decimal place`);
    }
    return Math.round(tenths) / 10;
}

/**
 * A single lowercase letter, mirroring the sheet's `7.5d` convention, or `null`
 * to clear one. `apply_overrides.py` pops the key on `null` rather than storing
 * it, matching the sync's habit of omitting it entirely.
 */
function validateQualifier(value: unknown): string | null {
    if (value === null) return null;
    if (typeof value !== 'string') throw badRequest('scoreQualifier: expected a letter or null');
    const trimmed = value.trim().toLowerCase();
    if (trimmed.length === 0) return null;
    if (!/^[a-z]$/.test(trimmed)) throw badRequest('scoreQualifier: expected a single letter a–z');
    return trimmed;
}

/**
 * Builds the rating patch, keeping only fields the body actually carried.
 *
 * A body with no recognized field is rejected rather than committed as a no-op:
 * it means the client sent something the worker doesn't understand, and a
 * silent 200 would look like a successful save.
 */
export function validateRatingPatch(body: unknown): RatingPatch {
    const raw = asRecord(body, 'rating');
    const patch: RatingPatch = {};

    if ('score' in raw) patch.score = validateScore(raw.score);
    if ('scoreQualifier' in raw) patch.scoreQualifier = validateQualifier(raw.scoreQualifier);
    if ('blurb' in raw) patch.blurb = optionalText(raw.blurb, LIMITS.blurb, 'blurb');

    if (Object.keys(patch).length === 0) {
        throw badRequest(`rating: nothing to update (expected one of ${RATING_FIELDS.join(', ')})`);
    }
    return patch;
}

/** Fields a member may set on a watch-log entry. `imdbID` comes from the path, never the body. */
const WATCHED_FIELDS = [
    'watchDate',
    'score',
    'scoreQualifier',
    'blurb',
    'image',
    'posterImage',
] as const;

/**
 * A partial watch-log update, with the same merge semantics as
 * {@link RatingPatch}: only the keys the body carried are touched, so saving a
 * review leaves the date and score alone.
 *
 * The difference is what an absent key means once stored. A rating override
 * defers to the sheet; a watch log has no second writer, so an unset field is
 * stored as an explicit `null` and the two cases collapse into one.
 */
export interface WatchedPatch {
    watchDate?: string;
    score?: number | null;
    scoreQualifier?: string | null;
    blurb?: string | null;
    image?: string | null;
    posterImage?: string | null;
}

/**
 * A calendar date as `YYYY-MM-DD`.
 *
 * Parsed strictly rather than handed to `new Date(...)` alone, which happily
 * turns `2026-02-31` into March 3rd — a silent off-by-a-few-days in the one
 * field the whole log is ordered by. Dates beyond tomorrow are rejected: the
 * club is not watching films next year, and a fat-fingered `2062` would sit
 * permanently at the top of the log.
 */
export function validateWatchDate(value: unknown, field = 'watchDate'): string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
        throw badRequest(`${field}: expected a date like 2026-08-09`);
    }
    const text = value.trim();
    const parsed = new Date(`${text}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
        throw badRequest(`${field}: ${text} is not a real date`);
    }
    // Tomorrow, not today: the caller's calendar can legitimately be a day ahead
    // of the worker's UTC clock.
    const limit = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (text > limit) throw badRequest(`${field}: ${text} is in the future`);
    return text;
}

/**
 * Builds a watch-log patch, keeping only the fields the body actually carried.
 *
 * An empty body is rejected for the same reason an empty rating patch is: it
 * means the client sent something this worker doesn't understand, and a silent
 * 200 would look like a save.
 */
export function validateWatchedPatch(body: unknown): WatchedPatch {
    const raw = asRecord(body, 'watched');
    const patch: WatchedPatch = {};

    if ('watchDate' in raw) patch.watchDate = validateWatchDate(raw.watchDate);
    if ('score' in raw) patch.score = validateScore(raw.score);
    if ('scoreQualifier' in raw) patch.scoreQualifier = validateQualifier(raw.scoreQualifier);
    if ('blurb' in raw) patch.blurb = optionalText(raw.blurb, LIMITS.blurb, 'blurb');
    if ('image' in raw) patch.image = validateImageUrl(raw.image);
    if ('posterImage' in raw) patch.posterImage = validateImageUrl(raw.posterImage, 'posterImage');

    if (Object.keys(patch).length === 0) {
        throw badRequest(`watched: nothing to update (expected one of ${WATCHED_FIELDS.join(', ')})`);
    }
    return patch;
}

/**
 * Validates a whole list body. Writes are whole-list rather than per-entry, so
 * this is the only entry point for list content.
 *
 * Ranks are assigned positionally from the array order — a client-supplied
 * `rank` is ignored, which keeps the stored ranks dense and 1-based however the
 * editor reorders. That holds for an unranked list too: `ranked` decides whether
 * the site draws the numbers, not whether the order is recorded.
 *
 * Duplicate ids keep their first occurrence, so a double-tapped "add" can't
 * produce a list with the same film twice.
 */
export function validateListInput(body: unknown): ListInput {
    const raw = asRecord(body, 'list');

    const name = optionalText(raw.name, LIMITS.listName, 'name');
    if (name === null) throw badRequest('name: a list needs a name');

    const description = optionalText(raw.description, LIMITS.listDescription, 'description');

    // Absent means ranked: that is what every list was before the flag existed,
    // and what a client too old to send it still means.
    if (raw.ranked !== undefined && raw.ranked !== null && typeof raw.ranked !== 'boolean') {
        throw badRequest('ranked: expected true or false');
    }
    const ranked = raw.ranked === undefined || raw.ranked === null ? true : raw.ranked;

    const rawEntries = raw.entries ?? [];
    if (!Array.isArray(rawEntries)) throw badRequest('entries: expected an array');
    if (rawEntries.length > LIMITS.entries) {
        throw badRequest(`entries: ${rawEntries.length} entries exceeds the ${LIMITS.entries} limit`);
    }

    const entries: FilmListEntry[] = [];
    const seen = new Set<string>();

    rawEntries.forEach((rawEntry, index) => {
        const entry = asRecord(rawEntry, `entries[${index}]`);
        const imdbID = validateImdbId(entry.imdbID, `entries[${index}].imdbID`);
        if (seen.has(imdbID)) return;
        seen.add(imdbID);
        entries.push({
            rank: entries.length + 1,
            imdbID,
            description: optionalText(
                entry.description,
                LIMITS.entryDescription,
                `entries[${index}].description`
            ),
            image: validateImageUrl(entry.image, `entries[${index}].image`),
            posterImage: validateImageUrl(entry.posterImage, `entries[${index}].posterImage`),
            // Absent and null are the same thing here — no score on this list —
            // because unlike a rating override there is no second writer to
            // defer to. The site fills the gap from the member's log or their
            // club rating when it renders the row.
            score:
                entry.score === undefined
                    ? null
                    : validateScore(entry.score, `entries[${index}].score`),
        });
    });

    return { name, description, ranked, entries };
}

/**
 * Resolves who a write is for.
 *
 * **This is the check that matters most.** Without it, signing in as any member
 * lets you rewrite everyone else's scores and lists. A body may name a
 * different owner only if the caller is an admin, and only if that owner is
 * itself a known member — an admin can act for someone, not invent them.
 */
export function resolveOwner(
    requested: unknown,
    caller: { name: string; admin: boolean },
    memberNames: readonly string[],
    /** What the caller is trying to write, for the refusal message alone. */
    what = 'lists'
): string {
    if (requested === null || requested === undefined || requested === '') return caller.name;
    if (typeof requested !== 'string') throw badRequest('owner: expected a member name');

    const wanted = requested.trim().toLowerCase();
    if (wanted === caller.name.toLowerCase()) return caller.name;
    if (!caller.admin) throw forbidden(`You can only edit your own ${what}.`);

    const match = memberNames.find((name) => name.toLowerCase() === wanted);
    if (!match) throw badRequest(`owner: "${requested}" is not a club member`);
    return match;
}

/**
 * Resolves who a list belongs to *after* a save.
 *
 * {@link resolveOwner} answers "who is this write for", and for a create that is
 * the whole question. An update asks a second one it can't see: a body carrying
 * no `owner` means **leave it where it is**, not "give it to the caller".
 *
 * The distinction only bites for an admin, and it bites hard. Admins may edit
 * anyone's list, and the editor never sends `owner` — so defaulting to the
 * caller silently retitled every list an admin touched as their own, id and
 * entries intact but attribution gone. Deferring to `existingOwner` keeps an
 * ownership transfer what it reads like: something the body actually asked for.
 *
 * `existingOwner` is `null` on create, where there is nothing to defer to.
 */
export function resolveListOwner(
    requested: unknown,
    caller: { name: string; admin: boolean },
    memberNames: readonly string[],
    existingOwner: string | null
): string {
    const named = requested !== null && requested !== undefined && requested !== '';
    if (!named && existingOwner !== null) return existingOwner;
    // A body that *did* name someone still goes through the full check, so a
    // non-admin naming another member is a 403 whether or not the list exists.
    return resolveOwner(requested, caller, memberNames);
}

/** URL-safe slug: lowercase, non-alphanumerics collapsed to single hyphens. */
export function slugify(value: string): string {
    return value
        .normalize('NFKD')
        // Strip combining marks so "Amélie" slugs as "amelie" rather than losing
        // the letter to the non-alphanumeric pass below.
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Assigns a list's permanent id: `slugify(owner + "-" + name)`, with a numeric
 * suffix on collision.
 *
 * Called once, on create. The id is immutable afterwards precisely so renaming a
 * list leaves its URL alone — which is the whole reason the editor assigns an id
 * instead of deriving one from the current name at render time.
 */
export function assignListId(owner: string, name: string, taken: Iterable<string>): string {
    const existing = new Set(taken);
    const base = slugify(`${owner}-${name}`) || 'list';
    if (!existing.has(base)) return base;
    for (let suffix = 2; ; suffix++) {
        const candidate = `${base}-${suffix}`;
        if (!existing.has(candidate)) return candidate;
    }
}
