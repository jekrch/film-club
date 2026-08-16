import React, {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

import { ClubApiError, GOOGLE_CLIENT_ID, getSession, isEditorConfigured } from '../api/clubApi';
import { clearWrites } from '../api/writeCache';
import { initGoogleIdentity, readTokenExpiry } from './gis';
import { clearToken, loadToken, saveToken } from './sessionStore';

/**
 * Who the current visitor is, for the editing surfaces only.
 *
 * The token is a Google ID token, kept in `sessionStorage` so a reload doesn't
 * cost a sign-in — a revision of §8.2, with the reasoning and the XSS tradeoff
 * set out in `sessionStore.ts`. Restoring is deliberately cheap and Google-free:
 * the stored token goes straight to our worker to be re-checked, so a refresh
 * loads no third-party script and shows no prompt.
 *
 * Google is involved again only when a token is about to expire, where GIS is
 * asked to issue a replacement. That path may quietly fail — it is best-effort,
 * and the session simply ends at expiry as it always did when it does.
 *
 * Nothing here runs for a visitor who has never signed in: with no stored token
 * the provider mounts, does nothing, and makes no request.
 */

export type AuthStatus = 'signed-out' | 'authenticating' | 'signed-in';

interface Session {
    token: string;
    /** Epoch ms from the token's own `exp` claim. */
    expiresAt: number;
    /** The `club.json` display name the worker resolved this email to. */
    member: string;
    admin: boolean;
}

export interface ClubAuthValue {
    status: AuthStatus;
    /** The signed-in member's `club.json` name, or null. */
    member: string | null;
    admin: boolean;
    /**
     * True while a session is being restored or renewed without anyone having
     * asked. Distinct from `authenticating`, which is a sign-in a person just
     * started and whose failure they should be told about.
     */
    resuming: boolean;
    /** Last sign-in failure, in words meant for the member. */
    error: string | null;
    /** False when this build has no worker URL or client ID; hide every editor. */
    configured: boolean;
    /** Hands a fresh GIS credential to the worker and starts a session. */
    acceptCredential: (credential: string) => Promise<void>;
    signOut: () => void;
    clearError: () => void;
    /**
     * Runs an authorized call with the current token, ending the session if the
     * worker rejects it. Every write goes through this rather than reading the
     * token directly, so expiry is handled in exactly one place.
     */
    withToken: <T>(call: (token: string) => Promise<T>) => Promise<T>;
    /** True when a member's name matches the signed-in member (or they're an admin). */
    canEditAs: (owner: string | null | undefined) => boolean;
}

const ClubAuthContext = createContext<ClubAuthValue | undefined>(undefined);

const SIGN_IN_TO_SAVE = 'Sign in to save changes.';
const SESSION_EXPIRED = 'Your sign-in expired. Sign in again to save.';

/**
 * How long before a token dies to ask Google for its replacement. Long enough
 * that a save started just before the swap still has a valid token behind it,
 * short enough not to be asking every few minutes.
 */
const RENEW_LEAD_MS = 2 * 60 * 1000;

/**
 * How long to wait on a renewal before giving up on it. GIS reports nothing
 * dependable when silent re-issue *doesn't* happen, so a timer is the only way
 * to know it isn't coming.
 */
const RENEW_TIMEOUT_MS = 8000;

export const ClubAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [status, setStatus] = useState<AuthStatus>('signed-out');
    const [resuming, setResuming] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // `withToken` needs the live session without being rebuilt on every change:
    // it is a dependency of effects and callbacks in the editors, and a new
    // identity each render would restart their requests.
    const sessionRef = useRef<Session | null>(null);
    sessionRef.current = session;

    // Restores and renewals are tracked in a ref as well as in state: the code
    // that receives a credential needs to know, right then, whether a person
    // asked for it or we did — and in the restore case that decision happens
    // before React has re-rendered anything.
    const resumingRef = useRef(false);
    const renewTimer = useRef<number | null>(null);

    const configured = useMemo(isEditorConfigured, []);

    const endSession = useCallback((reason: string | null) => {
        // Every path that drops a session comes through here — expiry, a 401
        // from the worker, an explicit sign-out — so this is the one place the
        // stored token has to be cleared for it to never outlive the session it
        // belongs to.
        clearToken();
        setSession(null);
        setStatus('signed-out');
        setError(reason);
    }, []);

    const finishResume = useCallback(() => {
        resumingRef.current = false;
        setResuming(false);
        if (renewTimer.current !== null) {
            window.clearTimeout(renewTimer.current);
            renewTimer.current = null;
        }
    }, []);

    const signOut = useCallback(() => {
        // Clears Google's "remember this account" hint so the next sign-in
        // offers the chooser rather than silently re-picking the same account —
        // which is the whole point of signing out on a shared machine.
        window.google?.accounts?.id?.disableAutoSelect();
        // Same reasoning for the cached write results: they are one member's
        // unsettled saves, and the next person to sign in on this tab should
        // not be shown them.
        clearWrites();
        finishResume();
        endSession(null);
    }, [endSession, finishResume]);

    const acceptCredential = useCallback(
        async (credential: string) => {
            const wasSilent = resumingRef.current;
            finishResume();
            setStatus('authenticating');
            setError(null);
            try {
                const { member, admin } = await getSession(credential);
                setSession({
                    token: credential,
                    expiresAt: readTokenExpiry(credential),
                    member,
                    admin,
                });
                setStatus('signed-in');
                // Stored only once the worker has vouched for it, so a rejected
                // credential is never left behind to be retried on every load.
                saveToken(credential);
            } catch (err) {
                // A 403 here is the ordinary case of someone signing in with a
                // Google account that isn't in MEMBER_EMAILS, so it gets a
                // plainer message than the worker's own.
                const message =
                    err instanceof ClubApiError && err.status === 403
                        ? "That Google account isn't set up for editing. Ask Jacob to add it."
                        : err instanceof Error
                          ? err.message
                          : 'Sign-in failed.';
                // Nobody asked for a restore, so nobody should be shown its
                // failure — a member whose stored token has gone stale should
                // find a signed-out nav, not an error about something they
                // didn't do. A renewal under a live session is the exception:
                // that one explains why the next save would fail.
                const reason = !wasSilent ? message : sessionRef.current ? SESSION_EXPIRED : null;
                endSession(reason);
            }
        },
        [endSession, finishResume]
    );

    // The GIS callback outlives any one render, so it reaches the current
    // handler through a ref rather than capturing the one it was created with.
    const accept = useRef(acceptCredential);
    accept.current = acceptCredential;

    /**
     * Puts a stored token back to work.
     *
     * It is re-checked against the worker rather than trusted: the signature is
     * not verifiable here, and `member`/`admin` can have changed since it was
     * issued. That costs one request, and only for someone who was signed in.
     */
    // One attempt per page load, guarded against StrictMode's double effect so
    // development doesn't send the worker two identical restores.
    const restored = useRef(false);
    useEffect(() => {
        if (!configured || restored.current) return;
        const token = loadToken();
        if (!token) return;

        restored.current = true;
        resumingRef.current = true;
        setResuming(true);
        void accept.current(token);
    }, [configured]);

    /**
     * Asks Google for a replacement token for the account this browser last
     * used, before the current one expires.
     *
     * Best-effort by nature. `auto_select` lets GIS answer without showing
     * anything when it can; when it can't it falls back to the One Tap card,
     * and when it does neither the timer below stops us waiting and the session
     * runs out on schedule.
     */
    const renewSession = useCallback(() => {
        if (!isEditorConfigured() || resumingRef.current) return;

        resumingRef.current = true;
        setResuming(true);

        // The prompt is deliberately not cancelled when this fires: if a One
        // Tap card is sitting on screen, clicking it should still work. All
        // that lapses is our waiting on it.
        renewTimer.current = window.setTimeout(finishResume, RENEW_TIMEOUT_MS);

        initGoogleIdentity(GOOGLE_CLIENT_ID, (credential) => {
            void accept.current(credential);
        })
            .then((gis) => gis.prompt())
            .catch(finishResume);
    }, [finishResume]);

    // Try for a replacement token shortly before this one dies, and drop the
    // session the moment it does rather than waiting for a save to fail on it.
    // Nothing schedules when signed out, so this is inert for every visitor who
    // never signs in.
    useEffect(() => {
        if (!session) return;
        const remaining = session.expiresAt - Date.now();
        if (remaining <= 0) {
            endSession(SESSION_EXPIRED);
            return;
        }

        // Only worth scheduling when there is real time to renew *into*: a
        // token already inside the lead window would renew immediately, and if
        // Google handed back the same near-expiry token that would spin.
        const renew =
            remaining > RENEW_LEAD_MS
                ? window.setTimeout(renewSession, remaining - RENEW_LEAD_MS)
                : null;
        const expire = window.setTimeout(() => endSession(SESSION_EXPIRED), remaining);

        return () => {
            if (renew !== null) window.clearTimeout(renew);
            window.clearTimeout(expire);
        };
    }, [session, endSession, renewSession]);

    const withToken = useCallback(
        async <T,>(call: (token: string) => Promise<T>): Promise<T> => {
            const current = sessionRef.current;
            if (!current) throw new ClubApiError(401, SIGN_IN_TO_SAVE);
            if (current.expiresAt <= Date.now()) {
                endSession(SESSION_EXPIRED);
                throw new ClubApiError(401, SESSION_EXPIRED);
            }
            try {
                return await call(current.token);
            } catch (err) {
                if (err instanceof ClubApiError && err.status === 401) {
                    endSession(SESSION_EXPIRED);
                }
                throw err;
            }
        },
        [endSession]
    );

    const canEditAs = useCallback(
        (owner: string | null | undefined) => {
            if (!session || !owner) return false;
            return session.admin || session.member.toLowerCase() === owner.trim().toLowerCase();
        },
        [session]
    );

    const value = useMemo<ClubAuthValue>(
        () => ({
            status,
            member: session?.member ?? null,
            admin: session?.admin ?? false,
            resuming,
            error,
            configured,
            acceptCredential,
            signOut,
            clearError: () => setError(null),
            withToken,
            canEditAs,
        }),
        [
            status,
            session,
            resuming,
            error,
            configured,
            acceptCredential,
            signOut,
            withToken,
            canEditAs,
        ]
    );

    return <ClubAuthContext.Provider value={value}>{children}</ClubAuthContext.Provider>;
};

export const useClubAuth = (): ClubAuthValue => {
    const context = useContext(ClubAuthContext);
    if (context === undefined) {
        throw new Error('useClubAuth must be used within a ClubAuthProvider');
    }
    return context;
};
