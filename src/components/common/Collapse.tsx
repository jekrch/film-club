import React, { useLayoutEffect, useRef, useState } from 'react';

import { prefersReducedMotion } from '../../utils/motion';

/**
 * How long the open and the close each take. Mirrors the two keyframes in
 * `index.css`, which is what actually times them — this is how long the content
 * has to be held in the tree for the close to finish playing.
 */
const DURATION_MS = 260;

/**
 * Keeps the content in the tree for exactly as long as it is worth drawing, and
 * measures it at both ends so the keyframes have a height to work between.
 *
 * The content is mounted when it opens and unmounted once it has closed, which
 * is what makes this a hook rather than two class names. Content that is removed
 * the instant it is closed cannot animate out, so the unmount is held back until
 * the close has played; nothing else here is about the closed state, because by
 * then the content is gone.
 *
 * `useLayoutEffect` throughout rather than `useEffect`: each of these runs after
 * the content is in the tree but before the browser paints, so a height is
 * readable and the animation is armed within the same frame. The reader never
 * sees the state it was measured from.
 */
const useOpenClose = (open: boolean) => {
    const ref = useRef<HTMLDivElement>(null);
    /** In the tree from the moment it opens until the close has finished. */
    const [mounted, setMounted] = useState(open);
    const [closing, setClosing] = useState(false);
    /** What the keyframes open to and close from, in pixels. */
    const [height, setHeight] = useState<number | null>(null);

    // Opening is immediate; the measurement below rides the same frame.
    useLayoutEffect(() => {
        if (!open) return;
        setClosing(false);
        setMounted(true);
    }, [open]);

    useLayoutEffect(() => {
        if (!open || !mounted) return;

        const element = ref.current;
        if (!element || prefersReducedMotion()) return;

        // Zero means nothing has laid out — a test environment, or content with
        // nothing in it. Animating to it would collapse it for a beat.
        const measured = element.scrollHeight;
        if (measured > 0) setHeight(measured);
    }, [open, mounted]);

    useLayoutEffect(() => {
        if (open || !mounted) return;

        // Measured again rather than reused from the open: the content may have
        // grown since it opened — a headshot finished loading, or the window
        // narrowed and a line of prose wrapped — and a close that starts from a
        // stale height jumps before it moves.
        const element = ref.current;
        const measured = element?.scrollHeight ?? 0;
        // Nothing to play, so nothing to hold the unmount for. Same two cases
        // the open skips on, plus a reader who has asked for less motion.
        if (measured === 0 || prefersReducedMotion()) {
            setMounted(false);
            return;
        }

        setHeight(measured);
        setClosing(true);

        const timer = setTimeout(() => {
            setMounted(false);
            setClosing(false);
        }, DURATION_MS);
        return () => clearTimeout(timer);
    }, [open, mounted]);

    return { ref, mounted, closing, height };
};

interface CollapseProps {
    open: boolean;
    id?: string;
    /** On the outer, height-animated box. Keep spacing off it; see below. */
    className?: string;
    /**
     * On the inner box, which is where margins, borders, and padding belong.
     * `overflow-hidden` on the outer makes it a formatting context, so a margin
     * here counts toward the measured height rather than collapsing out of it.
     */
    innerClassName?: string;
    children: React.ReactNode;
}

/**
 * Content that opens out in place and folds away again: a row's details panel,
 * the reactions tray, a thread of comments. One gesture, timed and eased the
 * same everywhere, so a page full of things that expand reads as one system.
 *
 * In the tree only while open, plus the moment it takes to close. The cost is
 * that it has to measure itself at each end of the gesture rather than
 * transition between two resting states; {@link useOpenClose} is the whole of
 * that.
 */
const Collapse: React.FC<CollapseProps> = ({
    open,
    id,
    className = '',
    innerClassName = '',
    children,
}) => {
    const { ref, mounted, closing, height } = useOpenClose(open);

    if (!mounted) return null;

    return (
        // Two elements, because the height being animated and the content's own
        // spacing cannot be the same box: a `max-height` of zero still paints a
        // border and still leaves a margin, so a single box would flash its top
        // rule into place before it had opened at all. The outer is the height,
        // the inner is the content.
        //
        // `overflow-hidden` from the first render rather than only while the
        // animation runs, and it is load-bearing twice over. It clips what the
        // cap is hiding; and it makes this box a formatting context, so the
        // inner margin counts toward the height instead of collapsing out of it
        // — which it would do on the render the measurement is taken from,
        // leaving the animation ending a margin short of where the content sits.
        <div
            id={id}
            ref={ref}
            className={`overflow-hidden${
                height === null ? '' : closing ? ' animate-details-close' : ' animate-details-open'
            }${className ? ` ${className}` : ''}`}
            style={
                height === null
                    ? undefined
                    : ({ '--details-height': `${height}px` } as React.CSSProperties)
            }
        >
            <div className={innerClassName}>{children}</div>
        </div>
    );
};

export default Collapse;
