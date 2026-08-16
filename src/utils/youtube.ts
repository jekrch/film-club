/**
 * The one rule for a member-supplied trailer link, shared by every editor that
 * offers the field.
 *
 * A row on a list or a watch log plays its trailer in the same modal a film page
 * does, from a YouTube video key. Where that key comes from is a three-step
 * fallback the resolvers own; this module is only about the step a member
 * controls — the link they paste when the film's own trailer is the wrong one,
 * a dead one, or (for a film the club never watched) missing entirely.
 *
 * What gets stored is the *key*, not the URL. It ends up interpolated into an
 * embed `src`, so it is parsed down to the eleven characters YouTube ids are
 * made of and rejected if it isn't exactly that — a stored URL would put
 * member-supplied text into an iframe address, which is the one place on this
 * site where being liberal about input would actually cost something.
 *
 * The worker validates again on save with the same rules —
 * `validateTrailerKey` in `worker/src/validate.ts`, duplicated rather than
 * imported for the reason given at the top of `worker/src/types.ts`. This copy
 * exists so a typo is caught while the member is still looking at the field.
 */

/** Long enough for any watch URL with tracking parameters still attached. */
export const TRAILER_URL_LIMIT = 300;

/** A YouTube video id: exactly eleven URL-safe characters. */
export const YOUTUBE_KEY_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/** The hosts a trailer link may come from, `www.`/`m.` prefixes stripped. */
const YOUTUBE_HOSTS = new Set(['youtube.com', 'youtube-nocookie.com', 'youtu.be']);

/** Path forms that carry the key as the last segment, e.g. `/embed/KEY`. */
const KEY_IN_PATH = /^\/(?:embed|v|shorts|live)\/([^/?#]+)/;

export type TrailerKeyResult = { value: string | null } | { error: string };

const BAD_LINK =
    "That doesn't look like a YouTube link — paste the address from the video's page, or its id.";

/**
 * Normalizes what a member typed to the video key that gets stored, or explains
 * why it can't be.
 *
 * Accepts the forms a member actually has in their clipboard: a `watch?v=` URL,
 * a `youtu.be` short link, an `/embed/` or `/shorts/` address, or a bare id
 * pasted out of one of those. Blank collapses to `null` so a cleared field and
 * one never filled in store the same value — which for this field means "use
 * whatever trailer the film itself has".
 */
export function parseTrailerLink(raw: string | null | undefined): TrailerKeyResult {
    const trimmed = (raw ?? '').trim();
    if (trimmed === '') return { value: null };
    if (trimmed.length > TRAILER_URL_LIMIT) {
        return {
            error: `That link is ${trimmed.length} characters; the limit is ${TRAILER_URL_LIMIT}.`,
        };
    }

    // A bare id first: it is a valid relative URL, so parsing it as one would
    // succeed and then fail the host check with a misleading message.
    if (YOUTUBE_KEY_PATTERN.test(trimmed)) return { value: trimmed };

    let parsed: URL;
    try {
        // Protocol-less pastes ("youtu.be/dQw4w9WgXcQ") are common enough to be
        // worth handling rather than refusing on a technicality.
        parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    } catch {
        return { error: BAD_LINK };
    }

    const host = parsed.hostname.toLowerCase().replace(/^(?:www\.|m\.)/, '');
    if (!YOUTUBE_HOSTS.has(host)) {
        return { error: 'Trailers play from YouTube, so the link has to be a YouTube one.' };
    }

    // `youtu.be/KEY` puts the key in the path; `youtube.com` uses `?v=` for a
    // watch URL and the path for every other form.
    const candidate =
        host === 'youtu.be'
            ? parsed.pathname.slice(1).split('/')[0]
            : (parsed.searchParams.get('v') ?? KEY_IN_PATH.exec(parsed.pathname)?.[1] ?? '');

    if (!YOUTUBE_KEY_PATTERN.test(candidate)) return { error: BAD_LINK };
    return { value: candidate };
}

/**
 * Which trailer a row plays, if any: the member's own link, then the film's.
 *
 * `film` is whichever record the row resolved against — a club film from
 * `films.json` or a summary from the list-film cache, both of which carry a
 * `trailerKey`. Taken structurally so this module stays clear of either type.
 *
 * Hiding is checked first and answers `null` outright, because it is the one
 * state the member set *about this row* rather than about the film.
 */
export const resolveTrailerKey = (
    entry: { trailerKey?: string | null; hideTrailer?: boolean },
    film: { trailerKey?: string | null } | null | undefined
): string | null => {
    if (entry.hideTrailer) return null;
    return entry.trailerKey ?? film?.trailerKey ?? null;
};
