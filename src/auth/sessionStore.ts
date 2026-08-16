import { readTokenExpiry } from './gis';

/**
 * Where an editing session survives a reload.
 *
 * This revises §8.2, which kept the ID token in memory only. That held the line
 * on XSS but made every refresh a fresh sign-in, and the intended escape hatch —
 * having GIS re-issue a token silently — turned out not to be dependable: our
 * own sign-out calls `disableAutoSelect`, which Google records persistently, and
 * One Tap carries an exponential cooldown that suppresses the prompt with no
 * signal back to the page. A resume that works some of the time is worse than
 * one that doesn't exist, because nobody can tell which day it is.
 *
 * So the token is stored, in `sessionStorage` rather than `localStorage`:
 *
 * - it survives reload and in-tab navigation, which is the whole complaint;
 * - it dies with the tab, so nothing is left on disk for a later reader;
 * - it is scoped to one tab, so a link opened in a new tab starts signed out.
 *
 * XSS on this origin can read it. That is a real widening and worth naming
 * plainly — though a script running on the page could already lift the in-memory
 * token out of the React tree or simply issue writes itself, and these tokens
 * expire in about an hour either way, which caps how long a stolen one is worth
 * anything.
 */

const KEY = 'cc.editor.token';

/**
 * Storage throws rather than no-ops in a few real situations — Safari's private
 * mode, a quota-full origin, webviews with storage disabled. None of those
 * should break signing in; they should just mean the session isn't sticky,
 * which is exactly the behavior this replaced.
 */
export function saveToken(token: string): void {
    try {
        sessionStorage.setItem(KEY, token);
    } catch {
        // Not sticky in this browser. Signing in still works.
    }
}

/**
 * The stored token, or null if there isn't a usable one.
 *
 * Expiry is checked here rather than by the caller so a dead token never
 * reaches the worker: restoring one would cost a round trip to be told what its
 * own `exp` claim already said, and would flash a signed-in nav on the way.
 */
export function loadToken(): string | null {
    try {
        const token = sessionStorage.getItem(KEY);
        if (!token) return null;
        if (readTokenExpiry(token) <= Date.now()) {
            clearToken();
            return null;
        }
        return token;
    } catch {
        return null;
    }
}

export function clearToken(): void {
    try {
        sessionStorage.removeItem(KEY);
    } catch {
        // Nothing to clear if nothing could be written.
    }
}
