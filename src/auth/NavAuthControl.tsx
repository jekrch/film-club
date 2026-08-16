import React, { useEffect, useRef, useState } from 'react';
import { UserCircleIcon } from '@heroicons/react/24/outline';
import classNames from 'classnames';

import Button from '../components/common/Button';
import GoogleSignInButton from './GoogleSignInButton';
import { useClubAuth } from './GoogleAuth';

/**
 * The nav's way in and out of an editing session.
 *
 * Deliberately close to invisible: the club is six people and everyone else is
 * here to read, so this is a dim outline glyph with no label, sitting at the end
 * of the nav where an account control is expected to be. It brightens on hover
 * and picks up the nav's blue once someone is actually signed in, which is the
 * only state worth announcing.
 *
 * Google's button is mounted only after the panel opens. That indirection is the
 * same one `SignInPrompt` makes and for the same reason: mounting it loads a
 * third-party script, and a nav that's on every page must not (§8.9).
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

/** Shared body of both variants: who you are, or the way to say so. */
const AuthPanelContents: React.FC = () => {
    const { status, member, admin, signOut } = useClubAuth();

    if (status === 'signed-in') {
        return (
            <>
                <p className="text-sm text-slate-300">
                    Signed in as <span className="text-slate-100">{member}</span>
                    {admin && <span className="text-slate-500"> · admin</span>}
                </p>
                <Button
                    type="button"
                    variant="link"
                    size="xs"
                    onClick={signOut}
                    className="mt-2 text-slate-400 hover:text-slate-200"
                >
                    Sign out
                </Button>
            </>
        );
    }

    return (
        <>
            <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-slate-500">
                Club members
            </p>
            <GoogleSignInButton className="mt-3" />
        </>
    );
};

const NavAuthControl: React.FC<NavAuthControlProps> = ({ variant = 'icon', className }) => {
    const { configured, status, resuming } = useClubAuth();
    const [isOpen, setIsOpen] = useState(false);
    const container = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;

        const onPointerDown = (event: MouseEvent | TouchEvent) => {
            if (!container.current?.contains(event.target as Node)) setIsOpen(false);
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
    }, [isOpen]);

    // Signing out from the open panel leaves it showing a sign-in form nobody
    // asked for, so the panel closes with the session.
    const signedIn = status === 'signed-in';
    const wasSignedIn = useRef(signedIn);
    useEffect(() => {
        if (wasSignedIn.current && !signedIn) setIsOpen(false);
        wasSignedIn.current = signedIn;
    }, [signedIn]);

    // A build with no worker has nothing to sign into, and the nav shouldn't
    // carry a control that leads nowhere (§6.2).
    if (!configured) return null;

    const label = signedIn ? 'Account' : 'Club member sign-in';

    if (variant === 'inline') {
        return (
            <div className={className}>
                <button
                    type="button"
                    onClick={() => setIsOpen((open) => !open)}
                    aria-expanded={isOpen}
                    className={classNames(
                        'flex w-full items-center gap-2 border-l border-transparent py-2 pl-3',
                        'text-base font-medium text-slate-500 transition-colors duration-200 hover:text-slate-300'
                    )}
                >
                    <UserCircleIcon
                        className={classNames('h-5 w-5', signedIn && 'text-blue-400/70')}
                    />
                    {signedIn ? 'Account' : 'Sign in'}
                </button>
                {isOpen && (
                    <div className="pb-2 pl-3">
                        <AuthPanelContents />
                    </div>
                )}
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
                className={classNames(
                    'flex items-center rounded-full p-1 transition-colors duration-200',
                    signedIn
                        ? 'text-blue-400/70 hover:text-blue-300'
                        : 'text-slate-600 hover:text-slate-300',
                    isOpen && !signedIn && 'text-slate-300',
                    // A resume in flight is worth a flicker of acknowledgement
                    // but not a spinner: this is background work the member
                    // never asked for and usually never notices.
                    resuming && 'animate-pulse'
                )}
            >
                <UserCircleIcon className="h-[1.15rem] w-[1.15rem]" />
            </button>

            {isOpen && (
                // Right-anchored so it can't push the page wider on the narrow
                // end of the desktop range.
                <div className="absolute right-0 top-full z-50 mt-2 w-60 rounded-md border border-slate-700/70 bg-slate-900/95 p-4 shadow-xl backdrop-blur-sm">
                    <AuthPanelContents />
                </div>
            )}
        </div>
    );
};

export default NavAuthControl;
