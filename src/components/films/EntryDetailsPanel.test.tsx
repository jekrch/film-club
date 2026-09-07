import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

import EntryDetailsPanel, { EntryDetailsToggle } from './EntryDetailsPanel';
import type { EntryDetails } from '../../utils/entryDetails';

/**
 * The panel's open and close are the reason this file exists.
 *
 * Both are keyframes over a height the panel measures for itself, and the close
 * only gets to play because the panel holds its own unmount back — none of which
 * is visible from the outside, and all of which is easy to undo by accident by
 * putting the render back behind `open &&` at a call site. What is asserted here
 * is the lifecycle those animations need, not the motion itself: that the panel
 * arrives armed with a height, that closing it swaps the animation rather than
 * removing the panel, and that it does leave afterwards.
 */

const details: EntryDetails = {
    tagline: 'A tagline.',
    plot: 'A plot.',
    crew: [],
    ratings: [],
    stills: [],
    cast: [],
};

/** A row, reduced to the two parts that matter: the chevron and the panel. */
const Row = () => {
    const [open, setOpen] = useState(false);
    return (
        <>
            <EntryDetailsToggle
                isOpen={open}
                onToggle={() => setOpen((current) => !current)}
                title="A Film"
                panelId="panel"
            />
            <EntryDetailsPanel
                details={details}
                panelId="panel"
                open={open}
                title="A Film"
                imdbID="tt1000001"
            />
        </>
    );
};

const panel = () => document.getElementById('panel');
const toggle = () => screen.getByRole('button');

describe('EntryDetailsPanel', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        // jsdom lays nothing out, so every element measures zero — which is the
        // one case the panel deliberately skips animating. Give it a height so
        // the animated path is the one under test.
        Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
            configurable: true,
            value: 300,
        });
    });

    afterEach(() => {
        jest.useRealTimers();
        Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight');
    });

    it('stays out of the tree until the row asks for it', () => {
        render(<Row />);
        expect(panel()).toBeNull();
    });

    it('arrives with the height its keyframe opens to', () => {
        render(<Row />);
        fireEvent.click(toggle());

        expect(panel()).toHaveClass('animate-details-open');
        expect(panel()!.style.getPropertyValue('--details-height')).toBe('300px');
    });

    it('holds its unmount for as long as the close takes to play', () => {
        render(<Row />);
        fireEvent.click(toggle());
        fireEvent.click(toggle());

        // Still here, and running the close rather than the open — a panel
        // removed on the click would have nothing left to animate.
        expect(panel()).toHaveClass('animate-details-close');

        act(() => {
            jest.advanceTimersByTime(400);
        });
        expect(panel()).toBeNull();
    });
});
