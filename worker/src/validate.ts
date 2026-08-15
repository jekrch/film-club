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
import type { FilmListEntry } from './types';

/** IMDb ids as they appear in `films.json`. */
export const IMDB_ID_PATTERN = /^tt\d{7,9}$/;

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
    /** Films in one member's watch log. A log grows for years; a list does not. */
    watched: 2000,
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

/** Validates an IMDb id from a URL path or a list entry. */
export function validateImdbId(value: unknown, field = 'imdbID'): string {
    if (typeof value !== 'string' || !IMDB_ID_PATTERN.test(value)) {
        throw badRequest(`${field}: expected an IMDb id like tt0107653`);
    }
    return value;
}

/**
 * Scores are numbers in 0–10 with at most one decimal place.
 *
 * The sheet path tolerates unparseable cells by storing them verbatim; the
 * worker deliberately does not — it only ever emits values that path would have
 * produced, so `films.json` stays uniform whichever writer filled a row.
 */
function validateScore(value: unknown): number | null {
    if (value === null) return null;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw badRequest('score: expected a number or null');
    }
    if (value < 0 || value > 10) throw badRequest('score: must be between 0 and 10');
    const tenths = value * 10;
    // Binary floating point means 8.1 * 10 is 81.00000000000001, so round-trip
    // rather than testing for an integer directly.
    if (Math.abs(tenths - Math.round(tenths)) > 1e-9) {
        throw badRequest('score: at most one decimal place');
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
const WATCHED_FIELDS = ['watchDate', 'score', 'scoreQualifier', 'blurb'] as const;

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
 * editor reorders. Duplicate ids keep their first occurrence, so a
 * double-tapped "add" can't produce a list with the same film twice.
 */
export function validateListInput(body: unknown): ListInput {
    const raw = asRecord(body, 'list');

    const name = optionalText(raw.name, LIMITS.listName, 'name');
    if (name === null) throw badRequest('name: a list needs a name');

    const description = optionalText(raw.description, LIMITS.listDescription, 'description');

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
        });
    });

    return { name, description, entries };
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
    memberNames: readonly string[]
): string {
    if (requested === null || requested === undefined || requested === '') return caller.name;
    if (typeof requested !== 'string') throw badRequest('owner: expected a member name');

    const wanted = requested.trim().toLowerCase();
    if (wanted === caller.name.toLowerCase()) return caller.name;
    if (!caller.admin) throw forbidden('You can only edit your own lists.');

    const match = memberNames.find((name) => name.toLowerCase() === wanted);
    if (!match) throw badRequest(`owner: "${requested}" is not a club member`);
    return match;
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
