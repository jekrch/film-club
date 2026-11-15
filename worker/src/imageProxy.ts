/**
 * A read-only image proxy for the few hosts whose images the site's canvas
 * can't otherwise draw.
 *
 * The retrospective's closing poster is drawn on a canvas so it can be saved
 * as an image, and a canvas that draws a cross-origin image without a CORS
 * header can't be exported. Criterion's own bucket, which holds about two in
 * five of the club's posters and many of its stills, sends none. This passes
 * those images through with `Access-Control-Allow-Origin: *`.
 *
 * It's the worker's one unauthenticated route, and kept narrow to match:
 *
 * - GET and HEAD only, no credentials in or out, so `*` is safe.
 * - Only URLs under {@link ALLOWED}; anything else is a 403 without a fetch,
 *   so this can't be pointed at an arbitrary host.
 * - No redirects followed, so an allowed URL can't bounce it elsewhere.
 * - Only `image/*` responses, at most {@link MAX_BYTES}, passed on.
 *
 * Responses are cached at Cloudflare's edge and in the browser for a long
 * time: a poster at a given URL never changes.
 */

/** Where the proxy lives, outside `/api`, which is all authenticated. */
export const IMAGE_PROXY_PATH = '/img';

/**
 * The images it will fetch: a host and the path they must start with. The
 * site's `posterImage.ts` keeps the same list to decide what to send here.
 */
const ALLOWED: { host: string; path: string }[] = [
    { host: 's3.amazonaws.com', path: '/criterion-production/' },
    { host: 'criterion-production.s3.amazonaws.com', path: '/' },
];

/** Larger than any poster or still; anything bigger isn't what this is for. */
const MAX_BYTES = 12 * 1024 * 1024;

/** A year, in seconds: a URL's image never changes. */
const CACHE_SECONDS = 365 * 24 * 60 * 60;

/** The CORS and safety headers every response carries, errors included. */
const BASE_HEADERS: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'X-Content-Type-Options': 'nosniff',
};

/**
 * The upstream URL a proxy request names, or null if it isn't one this will
 * fetch. Rejects anything but plain https on an allowed host and path, and any
 * URL carrying credentials or a port.
 */
export function allowedImageUrl(raw: string | null): URL | null {
    if (!raw) return null;
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        return null;
    }
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    // A dot-segment that slipped past `URL`'s normalising would be a way out of
    // the allowed prefix; there's no reason for a real image path to have one.
    if (url.pathname.includes('..') || url.pathname.includes('%2e') || url.pathname.includes('%2E'))
        return null;
    const host = url.hostname.toLowerCase();
    return ALLOWED.some((rule) => host === rule.host && url.pathname.startsWith(rule.path))
        ? url
        : null;
}

function fail(status: number, message: string): Response {
    return new Response(message, {
        status,
        headers: {
            ...BASE_HEADERS,
            'Content-Type': 'text/plain; charset=utf-8',
            // Errors aren't cached long: an upstream blip shouldn't stick.
            'Cache-Control': 'public, max-age=60',
        },
    });
}

/** Answers one request to {@link IMAGE_PROXY_PATH}. */
export async function proxyImage(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                ...BASE_HEADERS,
                'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                'Access-Control-Max-Age': '86400',
            },
        });
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        return fail(405, 'Only GET and HEAD.');
    }

    const target = allowedImageUrl(new URL(request.url).searchParams.get('url'));
    if (!target) return fail(403, 'Not an image this proxy fetches.');

    let upstream: Response;
    try {
        upstream = await fetch(target.toString(), {
            method: 'GET',
            redirect: 'manual',
            headers: { Accept: 'image/*' },
            cf: { cacheEverything: true, cacheTtl: CACHE_SECONDS },
        });
    } catch {
        return fail(502, 'Could not reach the image.');
    }

    if (upstream.status !== 200) {
        return fail(upstream.status === 404 ? 404 : 502, 'The image is not available.');
    }
    const type = upstream.headers.get('Content-Type') ?? '';
    if (!type.toLowerCase().startsWith('image/')) return fail(502, 'That is not an image.');
    // S3 always says how big an image is; a response that doesn't is refused
    // rather than streamed without a limit.
    const length = Number(upstream.headers.get('Content-Length') ?? '');
    if (!Number.isFinite(length) || length <= 0 || length > MAX_BYTES) {
        return fail(502, 'The image is missing its size or is too large.');
    }

    return new Response(request.method === 'HEAD' ? null : upstream.body, {
        status: 200,
        headers: {
            ...BASE_HEADERS,
            'Content-Type': type,
            'Cache-Control': `public, max-age=${CACHE_SECONDS}, immutable`,
            'Content-Length': String(length),
        },
    });
}
