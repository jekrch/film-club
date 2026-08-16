import { fireEvent, render, screen } from '@testing-library/react';

import type { ClubAuthValue } from './GoogleAuth';
import NavAuthControl from './NavAuthControl';

/**
 * The panel's dismiss behavior, which is shared by both variants and was for a
 * while wrong in one of them: the inline (mobile) variant never attached the
 * container ref the effect measures against, so every press read as an outside
 * one — including the press aimed at the Google button inside the panel.
 */

// The real button loads Google's script on mount. This stands in for it as an
// ordinary control inside the panel, which is all these tests press.
jest.mock('./GoogleSignInButton', () => ({
    __esModule: true,
    default: () => (
        <button type="button" data-testid="google-button">
            Continue with Google
        </button>
    ),
}));

let mockAuth: Partial<ClubAuthValue>;
jest.mock('./GoogleAuth', () => ({
    useClubAuth: () => mockAuth,
}));

const openPanel = (variant: 'icon' | 'inline') => {
    render(<NavAuthControl variant={variant} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByTestId('google-button')).toBeInTheDocument();
};

beforeEach(() => {
    mockAuth = {
        configured: true,
        status: 'signed-out',
        member: null,
        admin: false,
        resuming: false,
        signOut: jest.fn(),
    };
});

describe.each(['inline', 'icon'] as const)('NavAuthControl (%s)', (variant) => {
    it('stays open when the press lands on the sign-in button inside it', () => {
        openPanel(variant);

        fireEvent.mouseDown(screen.getByTestId('google-button'));

        expect(screen.getByTestId('google-button')).toBeInTheDocument();
    });

    it('stays open when the panel is tapped rather than clicked', () => {
        openPanel(variant);

        fireEvent.touchStart(screen.getByTestId('google-button'));

        expect(screen.getByTestId('google-button')).toBeInTheDocument();
    });

    it('closes on a press outside it', () => {
        openPanel(variant);

        fireEvent.mouseDown(document.body);

        expect(screen.queryByTestId('google-button')).not.toBeInTheDocument();
    });

    it('closes on Escape', () => {
        openPanel(variant);

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(screen.queryByTestId('google-button')).not.toBeInTheDocument();
    });

    it('stays open while a credential is in flight', () => {
        mockAuth = { ...mockAuth, status: 'authenticating' };
        openPanel(variant);

        fireEvent.mouseDown(document.body);

        expect(screen.getByTestId('google-button')).toBeInTheDocument();
    });
});
