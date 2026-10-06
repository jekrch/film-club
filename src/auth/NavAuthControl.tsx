import React, { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { UserCircleIcon } from '@heroicons/react/24/outline';
import { ArrowRightStartOnRectangleIcon, ChevronDownIcon } from '@heroicons/react/20/solid';
import classNames from 'classnames';

import GoogleSignInButton from './GoogleSignInButton';
import { useClubAuth } from './GoogleAuth';

/**
 * The nav's way in and out of an editing session.
 *
 * Deliberately close to invisible: the club is six people and everyone else is
 * here to read, so this is a dim outline glyph with no label, sitting at the end
 * of the nav where an account control is expected to be. It brightens on hover
 * and becomes the member's monogram, in the nav's blue, once someone is actually
 * signed in, which is the only state worth announcing.
 *
 * Google's button is mounted only after the panel opens, since it loads a
 * third-party script and the nav is on every page.
 */

interface NavAuthControlProps {
    /**
     * `icon` is the desktop control — a glyph with a panel hanging off it.
     * `inline` is the mobile menu, where a floating panel over a sheet that is
     * itself animating open reads as a glitch, so the same content is just a row
     * that expands in place.
     */
    variant?: 'icon' | 'inline';
    className?: string;
}

/**
 * True for the account chooser Google paints, which it appends to the body
 * rather than to the panel that asked for it.
 *
 * On desktop that chooser is a popup *window* and never touches this document,
 * but on a phone it is an in-page overlay — so a tap in it arrives here looking
 * exactly like a tap outside the panel. Closing on it would unmount the button
 * mid-sign-in, which is the one moment the panel must stay put.
 */
const isGoogleSurface = (target: Node | null): boolean =>
    target instanceof Element &&
    target.closest('[id^="credential_picker"], iframe[src*="accounts.google.com"]') !== null;

/**
 * The signed-in member as a monogram. Shared by the trigger and the panel's
 * header so the glyph you clicked is the one you find inside — the same blue
 * the bare icon used to pick up on sign-in, now carrying who it is.
 */
const MemberAvatar: React.FC<{ name: string | null; className?: string }> = ({
    name,
    className,
}) => (
    <span
        aria-hidden="true"
        className={classNames(
            'flex shrink-0 items-center justify-center rounded-full font-semibold',
            'bg-gradient-to-br from-blue-500/35 to-indigo-500/20 text-blue-100 ring-1 ring-blue-400/40',
            className
        )}
    >
        {name?.trim().charAt(0).toUpperCase() || '?'}
    </span>
);

/** Shared body of both variants: who you are, or the way to say so. */
const AuthPanelContents: React.FC<{ variant: 'icon' | 'inline' }> = ({ variant }) => {
    const { status, member, admin, signOut } = useClubAuth();
    // The inline variant hangs off a row whose label starts at pl-3, so its
    // contents line up with that rather than carrying the floating panel's inset.
    const inset = variant === 'icon' ? 'px-4' : 'pl-3 pr-2';

    if (status === 'signed-in') {
        return (
            <>
                <div className={classNames('flex items-center gap-3 py-3', inset)}>
                    <MemberAvatar name={member} className="h-9 w-9 text-sm" />
                    <div className="min-w-0">
                        <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-slate-500">
                            Signed in as
                        </p>
                        <p className="mt-0.5 flex items-center gap-2 text-sm font-medium text-slate-100">
                            <span className="truncate">{member}</span>
                            {admin && (
                                <span className="rounded-full border border-blue-400/30 bg-blue-400/10 px-1.5 py-px text-[9px] font-medium uppercase tracking-[0.12em] text-blue-300">
                                    Admin
                                </span>
                            )}
                        </p>
                    </div>
                </div>
                <div className={variant === 'icon' ? 'border-t border-slate-800/80 p-1.5' : 'pb-1'}>
                    <button
                        type="button"
                        onClick={signOut}
                        className={classNames(
                            'group flex w-full items-center gap-2.5 rounded-lg py-2 text-sm text-slate-400',
                            'transition-colors duration-150 hover:bg-slate-800/70 hover:text-slate-100',
                            variant === 'icon' ? 'px-2.5' : 'px-3'
                        )}
                    >
                        <ArrowRightStartOnRectangleIcon className="h-4 w-4 text-slate-500 transition-colors duration-150 group-hover:text-slate-300" />
                        Sign out
                    </button>
                </div>
            </>
        );
    }

    return (
        <div className={classNames(variant === 'icon' ? 'py-4' : 'py-2', inset)}>
            <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-slate-500">
                Club members
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">Sign in to make edits.</p>
            <GoogleSignInButton className="mt-3" />
        </div>
    );
};

/**
 * Enter and exit for the floating panel: a short drop and settle from the
 * corner it hangs off. Quick enough not to delay the sign-in button, and with
 * reduced motion asked for, only the fade survives.
 */
const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const panelMotion = (reduce: boolean) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.96 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 },
    transition: { duration: 0.18, ease: EASE_OUT },
});

const NavAuthControl: React.FC<NavAuthControlProps> = ({ variant = 'icon', className }) => {
    const { configured, status, resuming, member } = useClubAuth();
    const [isOpen, setIsOpen] = useState(false);
    const container = useRef<HTMLDivElement>(null);
    const panelId = useId();
    const reduceMotion = useReducedMotion() ?? false;

    useEffect(() => {
        if (!isOpen) return;

        const onPointerDown = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node | null;
            // No container means inside and outside can't be told apart, and
            // guessing "outside" would shut the panel on the member's own tap —
            // so the press is left alone. Both variants attach the ref, so this
            // is the mounting gap rather than an ordinary state.
            if (!container.current) return;
            if (container.current.contains(target)) return;
            if (isGoogleSurface(target)) return;
            // A credential is already in flight: whatever this press was for, it
            // wasn't dismissing a panel that is about to report how it went.
            if (status === 'authenticating') return;
            setIsOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsOpen(false);
        };

        // `mousedown` rather than `click`: closing on the press means a click
        // that starts outside the panel doesn't first activate whatever it
        // happens to land on inside it.
        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('touchstart', onPointerDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('touchstart', onPointerDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [isOpen, status]);

    // Signing out from the open panel leaves it showing a sign-in form nobody
    // asked for, so the panel closes with the session.
    const signedIn = status === 'signed-in';
    const wasSignedIn = useRef(signedIn);
    useEffect(() => {
        if (wasSignedIn.current && !signedIn) setIsOpen(false);
        wasSignedIn.current = signedIn;
    }, [signedIn]);

    // A build with no worker has nothing to sign into, so show no control.
    if (!configured) return null;

    const label = signedIn ? 'Account' : 'Club member sign-in';

    if (variant === 'inline') {
        return (
            // The same ref the icon variant carries: the dismiss effect above is
            // shared by both, and without a container to measure against it
            // reads every press as an outside one — which closed this panel on
            // the tap meant for the Google button inside it.
            <div ref={container} className={className}>
                <button
                    type="button"
                    onClick={() => setIsOpen((open) => !open)}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className={classNames(
                        'flex w-full items-center gap-2 border-l border-transparent py-2 pl-3 pr-2',
                        'text-base font-medium transition-colors duration-200',
                        isOpen ? 'text-slate-200' : 'text-slate-500 hover:text-slate-300'
                    )}
                >
                    {signedIn ? (
                        <MemberAvatar name={member} className="h-5 w-5 text-[10px]" />
                    ) : (
                        <UserCircleIcon className="h-5 w-5" />
                    )}
                    {signedIn ? 'Account' : 'Sign in'}
                    <ChevronDownIcon
                        className={classNames(
                            'ml-auto h-4 w-4 transition-transform duration-200',
                            isOpen && 'rotate-180'
                        )}
                    />
                </button>
                {/* Expands in place, the way the mobile sheet around it does. */}
                <AnimatePresence initial={false}>
                    {isOpen && (
                        <motion.div
                            id={panelId}
                            key="panel"
                            className="overflow-hidden"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: reduceMotion ? 0 : 0.22, ease: 'easeInOut' }}
                        >
                            <AuthPanelContents variant="inline" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    return (
        <div ref={container} className={classNames('relative', className)}>
            <button
                type="button"
                onClick={() => setIsOpen((open) => !open)}
                aria-label={label}
                title={label}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className={classNames(
                    'flex items-center gap-1 rounded-full transition-colors duration-200',
                    signedIn
                        ? 'py-0.5 pl-0.5 pr-1.5 text-blue-300/70 hover:bg-slate-800/60 hover:text-blue-200'
                        : 'p-1.5 text-slate-600 hover:bg-slate-800/60 hover:text-slate-300',
                    isOpen && 'bg-slate-800/70',
                    isOpen && !signedIn && 'text-slate-300',
                    // A resume in flight is worth a flicker of acknowledgement
                    // but not a spinner: this is background work the member
                    // never asked for and usually never notices.
                    resuming && 'animate-pulse'
                )}
            >
                {signedIn ? (
                    <>
                        <MemberAvatar
                            name={member}
                            className={classNames(
                                'h-7 w-7 text-xs transition-shadow duration-200',
                                isOpen && 'ring-blue-300/70'
                            )}
                        />
                        <ChevronDownIcon
                            className={classNames(
                                'h-3.5 w-3.5 transition-transform duration-200',
                                isOpen && 'rotate-180'
                            )}
                        />
                    </>
                ) : (
                    <UserCircleIcon className="h-[1.15rem] w-[1.15rem]" />
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    // Right-anchored so it can't push the page wider on the narrow
                    // end of the desktop range, and scaled from that corner so it
                    // grows out of the control rather than out of nowhere.
                    <motion.div
                        id={panelId}
                        key="panel"
                        {...panelMotion(reduceMotion)}
                        style={{ transformOrigin: 'top right' }}
                        className={classNames(
                            'absolute right-0 top-full z-50 mt-3 w-64 overflow-hidden rounded-xl',
                            'border border-slate-700/60 bg-slate-900/85 shadow-2xl shadow-black/50 backdrop-blur-xl',
                            // A hairline of the nav's active-link blue along the
                            // top edge, so the panel reads as part of the nav.
                            'before:pointer-events-none before:absolute before:inset-x-4 before:top-0 before:h-px',
                            'before:bg-gradient-to-r before:from-transparent before:via-blue-400/50 before:to-transparent'
                        )}
                    >
                        <AuthPanelContents variant="icon" />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default NavAuthControl;
