/**
 * A read-only image proxy for the images the site's canvas draws.
 *
 * The retrospective's closing poster is drawn on a canvas so it can be saved
 * as an image, and a canvas that draws a cross-origin image without a CORS
 * header can't be exported. Criterion's own bucket, which holds about two in
 * five of the club's posters and many of its stills, sends none. TMDb and
 * Amazon do, but fetched straight from them the images still failed on a
 * member's phone (most likely a privacy setting or blocker there), while the
 * same phone drew everything that came through here. So every image the
 * poster draws comes through here, with `Access-Control-Allow-Origin: *`.
 *
 * It's the worker's one unauthenticated route, and kept narrow to match:
 *
 * - GET and HEAD only, no credentials in or out.
 * - Only for the site's own pages: a request must carry an `Origin` in
 *   `ALLOWED_ORIGIN`, which is echoed back. A browser on any other site can't
 *   use this to serve images, though a script that forges the header can.
 * - Only URLs under {@link ALLOWED}, ending in a raster image's extension,
 *   with no query or fragment; anything else is a 403 without a fetch, so this
 *   can't be pointed at an arbitrary host, and a cache can't be dodged by
 *   varying a query string to run up the hosts' bandwidth.
 * - No redirects followed, so an allowed URL can't bounce it elsewhere.
 * - Only raster images ({@link RASTER_TYPES}), at most {@link MAX_BYTES},
 *   passed on, under a sandboxing CSP. No SVG: TMDb hosts uploaded SVG logos,
 *   and an SVG served from this origin could run script on it.
 *
 * What this can't stop is volume: anyone can request allowed images over and
 * over, and every request is a worker invocation against the account's quota
 * (which the editing API shares). See the worker README.
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
    // Criterion's posters and stills.
    { host: 's3.amazonaws.com', path: '/criterion-production/' },
    { host: 'criterion-production.s3.amazonaws.com', path: '/' },
    // TMDb's stills, at any size.
    { host: 'image.tmdb.org', path: '/t/p/' },
    // OMDb's posters.
    { host: 'm.media-amazon.com', path: '/images/' },
];

/** The image types passed on: the ones a poster or still comes as, and never SVG. */
const RASTER_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

/** The extensions an allowed URL may end in. */
const RASTER_EXTENSION = /\.(jpe?g|png|webp|gif)$/i;

/** Larger than any poster or still; anything bigger isn't what this is for. */
const MAX_BYTES = 12 * 1024 * 1024;

/** A year, in seconds: a URL's image never changes. */
const CACHE_SECONDS = 365 * 24 * 60 * 60;

/** The safety headers every response carries, errors included. */
const SAFETY_HEADERS: Record<string, string> = {
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'X-Content-Type-Options': 'nosniff',
    // Opened directly, nothing in a response can run or load anything.
    'Content-Security-Policy': "default-src 'none'; sandbox",
    Vary: 'Origin',
};

/** A request's `Origin` header, if it's one of the site's own; null otherwise. */
export function siteOrigin(origin: string | null, allowedOrigins: string): string | null {
    const allowed = allowedOrigins
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);
    return origin && allowed.includes(origin) ? origin : null;
}

/**
 * The upstream URL a proxy request names, or null if it isn't one this will
 * fetch. Rejects anything but plain https on an allowed host and path, ending
 * in a raster image's extension, and any URL carrying credentials, a port, a
 * query or a fragment.
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
    if (url.search || url.hash || !RASTER_EXTENSION.test(url.pathname)) return null;
    // A dot-segment that slipped past `URL`'s normalising would be a way out of
    // the allowed prefix; there's no reason for a real image path to have one.
    if (url.pathname.includes('..') || url.pathname.includes('%2e') || url.pathname.includes('%2E'))
        return null;
    const host = url.hostname.toLowerCase();
    return ALLOWED.some((rule) => host === rule.host && url.pathname.startsWith(rule.path))
        ? url
        : null;
}

function fail(status: number, message: string, origin: string | null): Response {
    return new Response(message, {
        status,
        headers: {
            ...SAFETY_HEADERS,
            ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
            'Content-Type': 'text/plain; charset=utf-8',
            // Errors aren't cached long: an upstream blip shouldn't stick.
            'Cache-Control': 'public, max-age=60',
        },
    });
}

/**
 * Answers one request to {@link IMAGE_PROXY_PATH}. `allowedOrigins` is the
 * worker's `ALLOWED_ORIGIN`: the site's own origins, comma-separated.
 */
export async function proxyImage(request: Request, allowedOrigins: string): Promise<Response> {
    const origin = siteOrigin(request.headers.get('Origin'), allowedOrigins);
    if (!origin) return fail(403, 'Only for the club site.', null);

    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                ...SAFETY_HEADERS,
                'Access-Control-Allow-Origin': origin,
                'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                'Access-Control-Max-Age': '86400',
            },
        });
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        return fail(405, 'Only GET and HEAD.', origin);
    }

    const target = allowedImageUrl(new URL(request.url).searchParams.get('url'));
    if (!target) return fail(403, 'Not an image this proxy fetches.', origin);

    let upstream: Response;
    try {
        upstream = await fetch(target.toString(), {
            method: 'GET',
            redirect: 'manual',
            // JPEG first: TMDb serves WebP to a browser that asks for it, and
            // the edge caches whichever it got first for everyone.
            headers: { Accept: 'image/jpeg,image/png;q=0.9,image/*;q=0.5' },
            cf: { cacheEverything: true, cacheTtl: CACHE_SECONDS },
        });
    } catch {
        return fail(502, 'Could not reach the image.', origin);
    }

    if (upstream.status !== 200) {
        return fail(upstream.status === 404 ? 404 : 502, 'The image is not available.', origin);
    }
    const type = (upstream.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
    if (!RASTER_TYPES.includes(type)) return fail(502, 'That is not a raster image.', origin);
    // S3 always says how big an image is; a response that doesn't is refused
    // rather than streamed without a limit.
    const length = Number(upstream.headers.get('Content-Length') ?? '');
    if (!Number.isFinite(length) || length <= 0 || length > MAX_BYTES) {
        return fail(502, 'The image is missing its size or is too large.', origin);
    }

    return new Response(request.method === 'HEAD' ? null : upstream.body, {
        status: 200,
        headers: {
            ...SAFETY_HEADERS,
            'Access-Control-Allow-Origin': origin,
            'Content-Type': type,
            'Cache-Control': `public, max-age=${CACHE_SECONDS}, immutable`,
            'Content-Length': String(length),
        },
    });
}
