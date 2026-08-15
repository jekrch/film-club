/**
 * Lazy loader and typings for Google Identity Services.
 *
 * The script is fetched on first use, never at app start: an ordinary visit to
 * a film page should not run a third-party script, so nothing here executes
 * until a member actually opens an editing surface (§8.9).
 *
 * Only the ID-token flow is used, which needs the OAuth *client ID* and no
 * client secret — that is what makes it workable from a static origin. Redirect
 * URIs aren't involved, so `HashRouter` is irrelevant here; the Google console
 * needs the authorized JavaScript *origins* instead.
 */

const GIS_SRC = 'https://accounts.google.com/gsi/client';

/** What GIS hands back to the callback: a signed JWT the worker verifies. */
export interface GoogleCredentialResponse {
    credential: string;
}

export interface GoogleButtonOptions {
    type?: 'standard' | 'icon';
    theme?: 'outline' | 'filled_blue' | 'filled_black';
    size?: 'small' | 'medium' | 'large';
    text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
    shape?: 'rectangular' | 'pill' | 'circle' | 'square';
    logo_alignment?: 'left' | 'center';
    width?: number;
}

/** The slice of `google.accounts.id` this app uses. */
export interface GoogleIdApi {
    initialize(config: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
        auto_select?: boolean;
        cancel_on_tap_outside?: boolean;
        use_fedcm_for_prompt?: boolean;
    }): void;
    renderButton(parent: HTMLElement, options: GoogleButtonOptions): void;
    /** Clears the "remember me" hint so the next sign-in offers the chooser. */
    disableAutoSelect(): void;
}

declare global {
    interface Window {
        google?: { accounts: { id: GoogleIdApi } };
    }
}

/**
 * Shared across every caller so the script tag is added once per page load;
 * cleared on failure so a later retry can try again rather than resolving to a
 * permanently broken promise.
 */
let loading: Promise<GoogleIdApi> | null = null;

export function loadGoogleIdentity(): Promise<GoogleIdApi> {
    if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);

    loading ??= new Promise<GoogleIdApi>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = GIS_SRC;
        script.async = true;
        script.defer = true;
        script.onload = () => {
            const api = window.google?.accounts?.id;
            if (api) resolve(api);
            else reject(new Error('Google sign-in loaded but exposed no API.'));
        };
        script.onerror = () => reject(new Error("Couldn't load Google sign-in."));
        document.head.appendChild(script);
    }).catch((error: unknown) => {
        loading = null;
        throw error;
    });

    return loading;
}

/**
 * Reads the `exp` claim without verifying anything.
 *
 * The signature check is the worker's job and cannot be done here; this exists
 * only so the app can stop using a token it knows has expired instead of
 * waiting for a 401 mid-save. A token whose payload won't parse is treated as
 * already expired, which fails closed.
 */
export function readTokenExpiry(token: string): number {
    try {
        const [, payload] = token.split('.');
        // JWTs are base64url: restore the standard alphabet before decoding.
        const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
        const { exp } = JSON.parse(json) as { exp?: number };
        return typeof exp === 'number' ? exp * 1000 : 0;
    } catch {
        return 0;
    }
}
