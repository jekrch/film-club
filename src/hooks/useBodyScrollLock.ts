import { useLayoutEffect } from 'react';

/**
 * Locks scrolling on the document body while `isLocked` is true (e.g. while a
 * modal is open), so content behind the overlay can't be scrolled.
 *
 * Mirrors the lock in `@jekrch/react-viewport-lightbox`, so the stills viewer
 * and the app's own modals hold the page identically:
 *
 * - The gutter check, not a padding guess. `html` carries
 *   `scrollbar-gutter: stable` (see index.css), so the scrollbar's width stays
 *   reserved while the scrollbar itself is hidden — the page gains nothing and
 *   needs no compensation. Adding the classic `padding-right: <scrollbar>`
 *   there narrows the page by that width and slides its centered content left,
 *   which is the shift this hook used to cause. The padding is applied only
 *   when the gutter is *not* reserved, i.e. in browsers without
 *   `scrollbar-gutter` support, where hiding the scrollbar really does widen
 *   the page.
 * - `position: fixed` with the scroll offset held in `top`. `overflow: hidden`
 *   alone is ignored by iOS Safari, which scrolls the page behind the overlay
 *   anyway. The offset is restored with `scrollTo` on release.
 * - `useLayoutEffect`, so the lock lands in the same frame the modal mounts
 *   rather than one paint later.
 *
 * Restores the previous inline values on unlock/unmount, and reference-counts
 * concurrent locks so closing one modal doesn't release the lock held by
 * another.
 */
let lockCount = 0;
let previousOverflow = '';
let previousPaddingRight = '';
let previousPosition = '';
let previousTop = '';
let previousWidth = '';
let lockedScrollY = 0;

export function useBodyScrollLock(isLocked: boolean): void {
    useLayoutEffect(() => {
        if (!isLocked) return;

        if (lockCount === 0) {
            const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
            const rootGutter = window.getComputedStyle(document.documentElement).scrollbarGutter;
            const reservesGutter = typeof rootGutter === 'string' && rootGutter.includes('stable');

            lockedScrollY = window.scrollY;
            previousOverflow = document.body.style.overflow;
            previousPaddingRight = document.body.style.paddingRight;
            previousPosition = document.body.style.position;
            previousTop = document.body.style.top;
            previousWidth = document.body.style.width;

            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.top = `-${lockedScrollY}px`;
            document.body.style.width = '100%';

            if (scrollbarWidth > 0 && !reservesGutter) {
                const currentPaddingRight =
                    parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;
                document.body.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`;
            }
        }
        lockCount += 1;

        return () => {
            lockCount -= 1;
            if (lockCount === 0) {
                document.body.style.overflow = previousOverflow;
                document.body.style.paddingRight = previousPaddingRight;
                document.body.style.position = previousPosition;
                document.body.style.top = previousTop;
                document.body.style.width = previousWidth;
                window.scrollTo(0, lockedScrollY);
            }
        };
    }, [isLocked]);
}
