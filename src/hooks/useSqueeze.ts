import { useLayoutEffect, useRef } from 'react';

/** How finely the squeeze is found: to 1/128, under a percent. */
const STEPS = 7;

/**
 * Finds how much a slide's give-way dimensions have to give for it to fit its
 * frame without scrolling, and sets that on the frame as `--squeeze`: 0 when
 * it fits as it is, up to 1 when everything that can give has given.
 *
 * `frame` is the scrolling box and `content` the box inside it that holds
 * everything. A slide marks the dimensions that may give (see `give` and
 * `.retro-give-aspect`), each running from its full value at 0 to its tightest
 * at 1. Whenever the frame or the content changes size, this tries the slide
 * at 0, then at 1, and if it fits only at 1 searches between them for the
 * least squeeze that fits, so nothing gives more than it has to. A slide that
 * doesn't fit even at 1 is left at 0 to scroll at full size: one that is both
 * cramped and scrolling is the worst of both. The search's trial layouts
 * happen between frames, so none is ever painted.
 *
 * The result is written to the element rather than through React, so a resize
 * doesn't re-render the slide and restart anything animating in it. Without
 * `ResizeObserver` (jsdom) the slide simply scrolls, as it would anyway.
 */
export function useSqueeze() {
    const frameRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const frame = frameRef.current;
        const content = contentRef.current;
        if (!frame || !content || typeof ResizeObserver === 'undefined') return;

        const set = (squeeze: number) => {
            if (squeeze > 0) frame.style.setProperty('--squeeze', String(squeeze));
            else frame.style.removeProperty('--squeeze');
        };
        const fits = (squeeze: number) => {
            set(squeeze);
            return frame.scrollHeight <= frame.clientHeight;
        };

        const measure = () => {
            if (fits(0)) return;
            if (!fits(1)) {
                set(0);
                return;
            }
            let loose = 0;
            let tight = 1;
            for (let i = 0; i < STEPS; i++) {
                const mid = (loose + tight) / 2;
                if (fits(mid)) tight = mid;
                else loose = mid;
            }
            set(tight);
        };

        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(frame);
        observer.observe(content);
        return () => {
            observer.disconnect();
            set(0);
        };
    }, []);

    return { frameRef, contentRef };
}

/**
 * A length that gives way as its slide is squeezed: `from` with room to spare,
 * `to` when everything that can give has given, and whatever lies between as
 * the fit needs (see {@link useSqueeze}). For an inline style: a margin, a
 * gap, a size. A picture's shape gives the same way through
 * `.retro-give-aspect` (in index.css), which can follow the breakpoint.
 *
 * Only dimensions that can lose a little without the slide reading
 * differently should give: the room between sections, the height of a still
 * that is cropped anyway. Type and figures stay their size, so no slide ever
 * looks like a smaller print of the others.
 */
export const give = (from: string, to: string): string =>
    `calc(${from} + (${to} - ${from}) * var(--squeeze, 0))`;
