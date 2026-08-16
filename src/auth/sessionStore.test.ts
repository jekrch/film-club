import { clearToken, loadToken, saveToken } from './sessionStore';

const KEY = 'cc.editor.token';

/**
 * A token whose `exp` claim is `secondsFromNow` away. Only the payload matters
 * here — nothing in the browser verifies the signature, so the header and
 * signature segments are just filler to make it three dot-separated parts.
 */
const tokenExpiringIn = (secondsFromNow: number): string => {
    const exp = Math.floor(Date.now() / 1000) + secondsFromNow;
    const payload = btoa(JSON.stringify({ exp })).replace(/\+/g, '-').replace(/\//g, '_');
    return `header.${payload}.signature`;
};

describe('sessionStore', () => {
    beforeEach(() => {
        sessionStorage.clear();
        jest.restoreAllMocks();
    });

    it('has nothing for a tab that has never signed in', () => {
        expect(loadToken()).toBeNull();
    });

    it('returns a live token across a reload', () => {
        const token = tokenExpiringIn(3600);
        saveToken(token);
        expect(loadToken()).toBe(token);
    });

    it('drops an expired token instead of sending it to the worker', () => {
        saveToken(tokenExpiringIn(-60));
        expect(loadToken()).toBeNull();
        // Cleared on the way out, so it isn't re-examined on every load.
        expect(sessionStorage.getItem(KEY)).toBeNull();
    });

    it('treats a token whose payload will not parse as expired', () => {
        // `readTokenExpiry` fails closed, and this asserts the store inherits
        // that rather than handing garbage to the worker.
        sessionStorage.setItem(KEY, 'not-a-jwt');
        expect(loadToken()).toBeNull();
    });

    it('clears on sign-out', () => {
        saveToken(tokenExpiringIn(3600));
        clearToken();
        expect(loadToken()).toBeNull();
    });

    it('uses sessionStorage, so nothing is left on disk', () => {
        const token = tokenExpiringIn(3600);
        saveToken(token);
        expect(sessionStorage.getItem(KEY)).toBe(token);
        expect(localStorage.getItem(KEY)).toBeNull();
    });

    it('treats unusable storage as "not signed in" rather than throwing', () => {
        // Safari's private mode and storage-disabled webviews throw here. The
        // cost should be a session that isn't sticky, not a broken page.
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('storage disabled');
        });
        jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('storage disabled');
        });

        expect(() => saveToken(tokenExpiringIn(3600))).not.toThrow();
        expect(loadToken()).toBeNull();
    });
});
