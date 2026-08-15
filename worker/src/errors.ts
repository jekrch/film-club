/**
 * The one error type the router knows how to turn into a response.
 *
 * Anything else escaping a handler is a bug, and is reported as a 500 with a
 * generic message so an internal failure can't leak repo or token detail to the
 * browser.
 */
export class HttpError extends Error {
    constructor(
        readonly status: number,
        message: string
    ) {
        super(message);
        this.name = 'HttpError';
    }
}

/** 400 — the request body or path was malformed. */
export function badRequest(message: string): HttpError {
    return new HttpError(400, message);
}

/** 401 — no usable ID token. */
export function unauthorized(message: string): HttpError {
    return new HttpError(401, message);
}

/** 403 — a valid token, but not for this data. */
export function forbidden(message: string): HttpError {
    return new HttpError(403, message);
}

/** 404 — the film, list, or override does not exist. */
export function notFound(message: string): HttpError {
    return new HttpError(404, message);
}
