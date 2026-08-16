/**
 * The one rule for a member-supplied artwork URL, shared by every editor that
 * offers the field.
 *
 * A member may point a list entry or a watch-log entry at their own image —
 * usually a frame they like better than the poster OMDB happens to have, and the
 * only way a film the club never watched gets scene art at all (the summary
 * cache is deliberately thin; see the note in `types/list.ts`). Nothing fetches
 * or proxies it: the URL is stored verbatim and handed to an `<img>`, so the
 * rules here are about what a browser on this site can actually render.
 *
 * The worker validates again on save with the same rules — `validateImageUrl` in
 * `worker/src/validate.ts`, duplicated rather than imported for the reason given
 * at the top of `worker/src/types.ts`. This copy exists so a typo is caught
 * while the member is still looking at the field.
 */

/** Matches the worker's cap. Long enough for a TMDb or Wikimedia URL. */
export const IMAGE_URL_LIMIT = 500;

export type ImageUrlResult = { value: string | null } | { error: string };

/**
 * Normalizes a typed URL to what gets stored, or explains why it can't be.
 *
 * `https` only: the site is served over HTTPS, and an `http` image is blocked as
 * mixed content — it would store cleanly and then render as nothing at all,
 * which is the most confusing outcome available. Blank collapses to `null` so a
 * cleared field and one never filled in store the same value.
 */
export function parseImageUrl(raw: string | null | undefined): ImageUrlResult {
    const trimmed = (raw ?? '').trim();
    if (trimmed === '') return { value: null };
    if (trimmed.length > IMAGE_URL_LIMIT) {
        return { error: `That URL is ${trimmed.length} characters; the limit is ${IMAGE_URL_LIMIT}.` };
    }

    let parsed: URL;
    try {
        parsed = new URL(trimmed);
    } catch {
        return { error: 'That image link needs to be a full URL, starting with https://.' };
    }
    if (parsed.protocol !== 'https:') {
        return { error: 'Image links must start with https:// — anything else is blocked in the browser.' };
    }

    return { value: trimmed };
}

/**
 * The same rule for a member's own avatar, which may additionally be a path
 * into the site's `public/images`.
 *
 * That exception exists because all six profiles are stored that way
 * (`/images/andy.jpg`), and a field that refused its own current value would
 * fail the first time someone edited the bio next to it. A path has to be
 * site-absolute and single-slashed: `//host/x` is a protocol-relative URL to
 * another origin wearing a path's clothes.
 *
 * Mirrors `validateProfileImage` in `worker/src/validate.ts`, which is the copy
 * that is actually trusted.
 */
export function parseProfileImageUrl(raw: string | null | undefined): ImageUrlResult {
    const trimmed = (raw ?? '').trim();
    if (trimmed.startsWith('/')) {
        if (trimmed.length > IMAGE_URL_LIMIT) {
            return { error: `That path is ${trimmed.length} characters; the limit is ${IMAGE_URL_LIMIT}.` };
        }
        if (trimmed.startsWith('//') || trimmed.includes('..')) {
            return { error: 'A site image path looks like /images/andy.jpg.' };
        }
        return { value: trimmed };
    }
    return parseImageUrl(trimmed);
}
