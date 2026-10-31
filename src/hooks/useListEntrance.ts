import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';

import { prefersReducedMotion } from '../utils/motion';

/** `page-enter`'s curve and lift, smaller: this is a list settling, not a page arriving. */
const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
const ENTER_MS = 360;
const LIFT = 'translateY(8px)';

/**
 * The gap between one item starting and the next, and how many gaps it runs to.
 * The cap is what keeps a tall screen's last row from waiting on all the others:
 * past it, the rest arrive together.
 */
const STAGGER_MS = 30;
const MAX_STAGGER_STEPS = 8;

/** The details panel's duration, as `AnimatedHeight` uses: the same kind of resize. */
const RESIZE_MS = 260;

const isOnScreen = (element: HTMLElement): boolean => {
    const { top, bottom } = element.getBoundingClientRect();
    return bottom > 0 && top < window.innerHeight;
};

interface ListEntrance {
    /** On the box holding the list; its descendants opt in with `data-entrance`. */
    containerRef: RefObject<HTMLDivElement | null>;
    /** Call just before a change that replaces the list, such as a filter. */
    prepareReplay: () => void;
}

/**
 * Eases a list's items into place when it changes: anything new when it grows,
 * and every item, with the box's height, when it is replaced outright.
 *
 * An item is any descendant carrying `data-entrance` with a value that stays the
 * same across renders. `content` is whatever changes when the list does.
 *
 * Web Animations rather than a class, because a replay has to restart on items
 * that stayed in the tree. The class route to that is a changed `key`, which
 * remounts every row and so shuts any details panel the reader had open.
 *
 * Only what's on screen animates, so a long list costs a handful of animations
 * rather than hundreds nobody can see. There's no fill past the end for the
 * reason `page-enter` gives: a transform left on a row would become the
 * containing block for the `position: fixed` modals inside it.
 */
export const useListEntrance = (content: unknown): ListEntrance => {
    const containerRef = useRef<HTMLDivElement>(null);
    /** Null until first paint, which is `page-enter`'s to animate. */
    const seen = useRef<Set<string> | null>(null);
    /** The box's height before a replay; null when the next change isn't one. */
    const replayFrom = useRef<number | null>(null);
    const running = useRef<Animation[]>([]);

    const prepareReplay = useCallback(() => {
        replayFrom.current = containerRef.current?.getBoundingClientRect().height ?? null;
    }, []);

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const from = replayFrom.current;
        replayFrom.current = null;

        const items = [...container.querySelectorAll<HTMLElement>('[data-entrance]')];
        const previous = seen.current;
        seen.current = new Set(items.map((item) => item.dataset.entrance ?? ''));

        if (!previous || prefersReducedMotion() || typeof container.animate !== 'function') return;

        // Before measuring, since a lift or a height still in flight would skew
        // it. A second click mid-replay starts from the height it had reached,
        // because `prepareReplay` read that while it was still running.
        running.current.forEach((animation) => animation.cancel());

        const entering = items.filter(
            (item) =>
                (from !== null || !previous.has(item.dataset.entrance ?? '')) && isOnScreen(item)
        );
        const to = container.getBoundingClientRect().height;

        const animations = entering.map((item, index) =>
            item.animate(
                [
                    { opacity: 0, transform: LIFT },
                    { opacity: 1, transform: 'none' },
                ],
                {
                    duration: ENTER_MS,
                    delay: Math.min(index, MAX_STAGGER_STEPS) * STAGGER_MS,
                    easing: EASING,
                    // Holds a waiting item at its first frame through its delay.
                    fill: 'backwards',
                }
            )
        );

        if (from !== null && Math.abs(from - to) > 1) {
            // `clip`, not `hidden`: it can apply to one axis and leave the other
            // visible, and it makes no scroll container of the box.
            animations.push(
                container.animate(
                    [
                        { height: `${from}px`, overflowY: 'clip' },
                        { height: `${to}px`, overflowY: 'clip' },
                    ],
                    { duration: RESIZE_MS, easing: EASING }
                )
            );
        }

        running.current = animations;
    }, [content]);

    return { containerRef, prepareReplay };
};
