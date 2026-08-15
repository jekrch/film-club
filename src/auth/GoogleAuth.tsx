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

import { ClubApiError, getSession, isEditorConfigured } from '../api/clubApi';
import { readTokenExpiry } from './gis';

/**
 * Who the current visitor is, for the editing surfaces only.
 *
 * The token is a Google ID token and is held **in memory only** — deliberately
 * not in `localStorage` or `sessionStorage`, which would widen the blast radius
 * of any XSS on the site (§8.2). The cost is that a reload signs you out; the
 * benefit is that a stolen script can't lift a credential off disk. Tokens last
 * about an hour, so an editing session outliving one is rare.
 *
 * Nothing here runs on an ordinary page view: the provider mounts with no
 * session, loads no script, and makes no request until a member opens an
 * editing surface and signs in.
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

export const ClubAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [status, setStatus] = useState<AuthStatus>('signed-out');
    const [error, setError] = useState<string | null>(null);

    // `withToken` needs the live session without being rebuilt on every change:
    // it is a dependency of effects and callbacks in the editors, and a new
    // identity each render would restart their requests.
    const sessionRef = useRef<Session | null>(null);
    sessionRef.current = session;

    const configured = useMemo(isEditorConfigured, []);

    const endSession = useCallback((reason: string | null) => {
        setSession(null);
        setStatus('signed-out');
        setError(reason);
    }, []);

    const signOut = useCallback(() => {
        // Clears Google's "remember this account" hint so the next sign-in
        // offers the chooser rather than silently re-picking the same account —
        // which is the whole point of signing out on a shared machine.
        window.google?.accounts?.id?.disableAutoSelect();
        endSession(null);
    }, [endSession]);

    const acceptCredential = useCallback(
        async (credential: string) => {
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
                endSession(message);
            }
        },
        [endSession]
    );

    // Drop the session the moment its token expires rather than waiting for a
    // save to fail on it. Nothing schedules when signed out, so this is inert
    // for every visitor who never signs in.
    useEffect(() => {
        if (!session) return;
        const remaining = session.expiresAt - Date.now();
        if (remaining <= 0) {
            endSession(SESSION_EXPIRED);
            return;
        }
        const timer = window.setTimeout(() => endSession(SESSION_EXPIRED), remaining);
        return () => window.clearTimeout(timer);
    }, [session, endSession]);

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
            error,
            configured,
            acceptCredential,
            signOut,
            clearError: () => setError(null),
            withToken,
            canEditAs,
        }),
        [status, session, error, configured, acceptCredential, signOut, withToken, canEditAs]
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
