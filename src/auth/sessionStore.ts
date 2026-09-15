import { readTokenExpiry } from './gis';

/**
 * Persists the editor's ID token in `sessionStorage` so a session survives
 * reloads within the same tab. The token is cleared when the tab closes and is
 * not shared with other tabs.
 *
 * Scripts on this origin can read it; tokens expire after about an hour.
 */

const KEY = 'cc.editor.token';

/** Storage can throw (private mode, full quota, disabled storage); failures are ignored. */
export function saveToken(token: string): void {
    try {
        sessionStorage.setItem(KEY, token);
    } catch {
        // Storage unavailable; the session just won't persist.
    }
}

/** Returns the stored token, or null if none exists or it has expired. */
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
        // Storage unavailable; nothing to clear.
    }
}
