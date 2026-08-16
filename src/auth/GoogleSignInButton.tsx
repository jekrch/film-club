import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { GOOGLE_CLIENT_ID } from '../api/clubApi';
import { useClubAuth } from './GoogleAuth';
import type { GoogleButtonOptions } from './gis';
import { initGoogleIdentity } from './gis';

/**
 * The Sign in with Google button, rendered by Google's own library.
 *
 * **Mounting this loads a third-party script**, which is why it never appears
 * on an ordinary page view — it renders only inside an editing surface a member
 * has already opened (§8.9). Google requires its own rendered button for the ID
 * token flow; a hand-styled one isn't an option, so this is a thin wrapper that
 * hands the resulting credential to the auth context.
 *
 * Everything it *can* choose is chosen here rather than at the five call sites,
 * so the button looks the same in the nav panel as it does in a rating editor.
 */

/**
 * The button's appearance, as far as Google's options reach: what is inside the
 * iframe is theirs, and no stylesheet of ours crosses that boundary.
 *
 * `filled_black` is the dark treatment — #202124 face, white label, the
 * four-colour mark. It is a warm neutral next to the site's cool slate rather
 * than a match for it, and Google gives no way to close that gap: what is inside
 * the iframe is theirs. The alternative, `outline`, is a white slab on a dark
 * page, which is louder than a sign-in row wants to be.
 *
 * `large` is 40px in Google's stylesheet, matching the height reserved below and
 * the touch target of a nav row; `medium` is 32px and left an eight-pixel gap.
 */
const APPEARANCE: GoogleButtonOptions = {
    type: 'standard',
    theme: 'filled_black',
    size: 'large',
    text: 'signin_with',
    shape: 'pill',
    // Centred rather than left: the button is given a width below instead of
    // taking its text's, and a left-hugged label under a fixed width reads as a
    // button that didn't finish loading. It also matches `Button`, which centres
    // its own contents.
    logo_alignment: 'center',
};

/** Google clamps to 200px at the low end; 320 keeps it from spanning a card. */
const MIN_WIDTH = 200;
const MAX_WIDTH = 320;

/**
 * How much a container has to change before the button is re-rendered at a new
 * width. Re-rendering rebuilds Google's iframe, so it isn't worth doing for the
 * single pixel a scrollbar takes.
 */
const WIDTH_STEP = 8;

const GoogleSignInButton: React.FC<{ className?: string }> = ({ className }) => {
    const { acceptCredential, status, error, configured } = useClubAuth();
    const frame = useRef<HTMLDivElement>(null);
    const target = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState<number | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);

    // The callback GIS keeps is the one from the render that initialized it, so
    // it reads the handler through a ref rather than capturing a stale closure.
    const accept = useRef(acceptCredential);
    accept.current = acceptCredential;

    /**
     * Google's button sizes itself to its label unless given a width, which left
     * it floating inside every container it was put in — short of the nav
     * panel's edges in one place and adrift in a card in another. Measuring the
     * space it was given and handing that to `renderButton` is the only way to
     * make it sit in the layout like the site's own buttons do.
     */
    useLayoutEffect(() => {
        if (!configured) return;

        const measure = () => {
            const available = frame.current?.clientWidth;
            if (!available) return;
            const next = Math.min(Math.max(available, MIN_WIDTH), MAX_WIDTH);
            setWidth((current) =>
                current !== null && Math.abs(current - next) < WIDTH_STEP
                    ? current
                    : Math.round(next)
            );
        };

        measure();
        // Absent under jsdom, and not worth a polyfill: one measurement is the
        // right answer for a container that never resizes.
        if (typeof ResizeObserver === 'undefined' || !frame.current) return;
        const observer = new ResizeObserver(measure);
        observer.observe(frame.current);
        return () => observer.disconnect();
    }, [configured]);

    useEffect(() => {
        if (!configured || width === null) return;
        let cancelled = false;

        // Initialization is shared with the session resume and happens once per
        // page (see `gis.ts`); this only claims the credential handler and asks
        // for a button. Nothing here calls `prompt()`, so no One Tap card
        // appears — pressing this button still goes through the account
        // chooser, which is what an explicit "I want to edit" should do.
        initGoogleIdentity(GOOGLE_CLIENT_ID, (credential) => {
            void accept.current(credential);
        })
            .then((gis) => {
                if (cancelled || !target.current) return;
                // Google appends rather than replaces, so a re-render at a new
                // width would otherwise stack a second button under the first.
                target.current.replaceChildren();
                gis.renderButton(target.current, { ...APPEARANCE, width });
            })
            .catch((err: unknown) => {
                if (!cancelled) {
                    setLoadError(
                        err instanceof Error ? err.message : "Couldn't load Google sign-in."
                    );
                }
            });

        return () => {
            cancelled = true;
        };
    }, [configured, width]);

    if (!configured) return null;

    const message = loadError ?? error;

    return (
        <div className={className}>
            {/* One 40px row, occupied by the button whatever state it is in: the
                height is reserved before Google's script arrives, and held
                during a sign-in so neither the panel nor the card it sits in
                changes size under the member's hand. */}
            <div ref={frame} className="relative min-h-10">
                {/* Google paints into this node once, so it is hidden rather than
                    unmounted while a sign-in is in flight: a failed attempt that
                    remounted it would come back to an empty div, since the effect
                    above runs only when the width changes. */}
                <div
                    ref={target}
                    className={status === 'authenticating' ? 'invisible' : undefined}
                />
                {status === 'authenticating' && (
                    <p className="absolute inset-0 flex items-center text-sm italic text-slate-400">
                        Signing in…
                    </p>
                )}
            </div>
            {/* Held to the button's own width so a long failure from the worker
                doesn't set the line length for the panel around it. */}
            {message && (
                <p className="mt-2 max-w-xs text-sm leading-snug text-rose-300">{message}</p>
            )}
        </div>
    );
};

export default GoogleSignInButton;
