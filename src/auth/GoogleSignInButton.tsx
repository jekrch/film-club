import React, { useEffect, useRef, useState } from 'react';

import { GOOGLE_CLIENT_ID } from '../api/clubApi';
import { useClubAuth } from './GoogleAuth';
import { loadGoogleIdentity } from './gis';

/**
 * The Sign in with Google button, rendered by Google's own library.
 *
 * **Mounting this loads a third-party script**, which is why it never appears
 * on an ordinary page view — it renders only inside an editing surface a member
 * has already opened (§8.9). Google requires its own rendered button for the ID
 * token flow; a hand-styled one isn't an option, so this is a thin wrapper that
 * hands the resulting credential to the auth context.
 */
const GoogleSignInButton: React.FC<{ className?: string }> = ({ className }) => {
    const { acceptCredential, status, error, configured } = useClubAuth();
    const target = useRef<HTMLDivElement>(null);
    const [loadError, setLoadError] = useState<string | null>(null);

    // The callback GIS keeps is the one from the render that initialized it, so
    // it reads the handler through a ref rather than capturing a stale closure.
    const accept = useRef(acceptCredential);
    accept.current = acceptCredential;

    useEffect(() => {
        if (!configured) return;
        let cancelled = false;

        loadGoogleIdentity()
            .then((gis) => {
                if (cancelled || !target.current) return;
                gis.initialize({
                    client_id: GOOGLE_CLIENT_ID,
                    callback: ({ credential }) => {
                        void accept.current(credential);
                    },
                    // No One Tap: this is an explicit "I want to edit" action, and
                    // an auto-selected account is a surprise on a shared machine.
                    auto_select: false,
                    cancel_on_tap_outside: true,
                });
                gis.renderButton(target.current, {
                    type: 'standard',
                    theme: 'filled_black',
                    size: 'medium',
                    text: 'signin_with',
                    shape: 'pill',
                    logo_alignment: 'left',
                });
            })
            .catch((err: unknown) => {
                if (!cancelled) {
                    setLoadError(err instanceof Error ? err.message : "Couldn't load Google sign-in.");
                }
            });

        return () => {
            cancelled = true;
        };
    }, [configured]);

    if (!configured) return null;

    return (
        <div className={className}>
            {/* Google paints into this node once, so it is hidden rather than
                unmounted while a sign-in is in flight: a failed attempt that
                remounted it would come back to an empty div, since the effect
                above runs only on mount. Height is reserved so the panel doesn't
                jump when the script finishes loading. */}
            <div ref={target} className={status === 'authenticating' ? 'hidden' : 'min-h-[40px]'} />
            {status === 'authenticating' && (
                <p className="text-sm italic text-slate-400">Signing in…</p>
            )}
            {(loadError ?? error) && (
                <p className="mt-2 text-sm text-rose-300">{loadError ?? error}</p>
            )}
        </div>
    );
};

export default GoogleSignInButton;
