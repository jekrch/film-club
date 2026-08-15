import React, { useState } from 'react';

import Button from '../components/common/Button';
import GoogleSignInButton from './GoogleSignInButton';
import { useClubAuth } from './GoogleAuth';

/**
 * A quiet way into an editing session, for pages that have editable content but
 * no editor open yet — the member's own profile, principally (§8.9).
 *
 * The Google button appears only after a click. That indirection is the point:
 * mounting it loads a third-party script, and a visitor reading a profile
 * should not pay for a sign-in they never asked for.
 */
const SignInPrompt: React.FC<{ className?: string }> = ({ className }) => {
    const { configured, status, member, signOut } = useClubAuth();
    const [asked, setAsked] = useState(false);

    if (!configured) return null;

    if (status === 'signed-in') {
        return (
            <p className={`text-xs text-slate-500 ${className ?? ''}`}>
                Signed in as {member}.{' '}
                <Button
                    type="button"
                    variant="link"
                    size="xs"
                    onClick={signOut}
                    className="text-slate-400 hover:text-slate-200"
                >
                    Sign out
                </Button>
            </p>
        );
    }

    return (
        <div className={className}>
            {asked ? (
                <GoogleSignInButton />
            ) : (
                <Button
                    type="button"
                    variant="link"
                    size="xs"
                    onClick={() => setAsked(true)}
                    className="text-slate-500 hover:text-slate-300"
                >
                    Club member? Sign in to edit
                </Button>
            )}
        </div>
    );
};

export default SignInPrompt;
