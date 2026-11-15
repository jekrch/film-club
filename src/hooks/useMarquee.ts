import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

/**
 * How fast every strip of film on the retrospective travels, in pixels a
 * second. One speed for all of them, however long or tall: a reel's duration is
 * worked out from its length, so a reel of big frames in the bottom bar and a
 * thin one at the top of a phone screen drift at the same pace.
 */
export const MARQUEE_PX_PER_SECOND = 14;

/** The pace to assume per item until the row has been measured. */
const FALLBACK_SECONDS_PER_ITEM = 9;

/**
 * A row that scrolls sideways forever. The row renders its items twice, back
 * to back; `copyLength` is how many items are in one copy.
 *
 * The movement is a plain CSS animation (`retro-marquee` in `index.css`), so it
 * runs from the first frame whatever else happens. Measuring only tunes it:
 * the loop distance is the offset from the first item to the first item of the
 * second copy, so the seam is exact whatever the gaps are, and the duration
 * follows at {@link MARQUEE_PX_PER_SECOND}. Until a measurement comes back (or
 * if one never does, for a row that is hidden), the row moves half its width
 * at an estimated pace instead. Reduced motion stops it in CSS.
 *
 * Returns the ref and the style to put on the row.
 */
export function useMarquee(copyLength: number, reverse = false) {
    const ref = useRef<HTMLDivElement>(null);
    const [loop, setLoop] = useState(0);

    useLayoutEffect(() => {
        const row = ref.current;
        if (!row) return;
        const measure = () => {
            const first = row.children[0] as HTMLElement | undefined;
            const second = row.children[copyLength] as HTMLElement | undefined;
            const distance = first && second ? second.offsetLeft - first.offsetLeft : 0;
            if (distance > 0) setLoop(distance);
        };
        measure();
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(measure);
        observer.observe(row);
        return () => observer.disconnect();
    }, [copyLength]);

    const style = {
        '--marquee-shift': loop > 0 ? `-${loop}px` : '-50%',
        animationDuration: `${
            loop > 0
                ? loop / MARQUEE_PX_PER_SECOND
                : Math.max(1, copyLength) * FALLBACK_SECONDS_PER_ITEM
        }s`,
        animationDirection: reverse ? 'reverse' : 'normal',
    } as CSSProperties;

    return { ref, style, className: 'retro-marquee' };
}
