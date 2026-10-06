import React, { useLayoutEffect, useRef, useState } from 'react';

interface AnimatedHeightProps {
    /** On the outer, height-animated box. Keep spacing off it, as with `Collapse`. */
    className?: string;
    children: React.ReactNode;
}

/**
 * Content that stays open but changes height in place — a chart redrawn with
 * more bars or fewer — eased from its old height to its new one rather than
 * shoving everything below it in a single frame. `Collapse` is the same gesture
 * for content that opens and closes; this is for content that only resizes.
 *
 * The content is measured on every change and the outer box is given that
 * height, which `.animate-height` transitions. A transition works here where
 * `Collapse` needs a keyframe: this box is already in the tree with a height
 * when the next one arrives, so there is always a before and an after.
 *
 * Without a measurement (first paint, no ResizeObserver) the box sizes itself
 * and a change simply snaps.
 */
const AnimatedHeight: React.FC<AnimatedHeightProps> = ({ className = '', children }) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState<number | null>(null);

    useLayoutEffect(() => {
        const element = contentRef.current;
        if (!element || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => {
            // Zero means nothing has laid out; easing to it would collapse the
            // box for a beat. Same rule as `Collapse`.
            const measured = element.offsetHeight;
            if (measured > 0) setHeight(measured);
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    return (
        // `overflow-hidden` clips the content while the box is shorter than it
        // (growing) and hides the space it has left (shrinking). `flow-root` on
        // the inner box keeps its children's margins inside what is measured.
        <div
            className={`animate-height overflow-hidden${className ? ` ${className}` : ''}`}
            style={height === null ? undefined : { height }}
        >
            <div ref={contentRef} className="flow-root">
                {children}
            </div>
        </div>
    );
};

export default AnimatedHeight;
