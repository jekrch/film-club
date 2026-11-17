import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MARQUEE_PX_PER_SECOND } from '../../hooks/useMarquee';
import { prefersReducedMotion } from '../../utils/motion';

interface FilmReelProps {
    /**
     * The stills to run. When they change, the frames already on screen carry
     * on and leave as before; only those still waiting off the right-hand edge
     * are swapped for the new ones, which then stream in after them.
     */
    stills: string[];
    /** The frames' height; their width follows at 16:9. */
    frameClass?: string;
    /** The sprocket margins' height. */
    sprocketClass?: string;
    className?: string;
}

interface Frame {
    id: number;
    url: string;
}

/** Where the reel is: what it runs, how far it has travelled, how far apart its frames sit. */
interface ReelState {
    pool: string[];
    /** The next of the pool's stills to put on the end. */
    cursor: number;
    nextId: number;
    /** How far the first frame has gone off the left-hand edge, in pixels. */
    offset: number;
    /** From one frame's left edge to the next's, once measured. */
    pitch: number;
    /** The first frame has gone and the reel is waiting for it to leave the page. */
    dropping: boolean;
}

/** A frame's pitch to assume until one has been measured. */
const GUESS_PITCH = 80;

/** From the row's first frame to its second; 0 while the row is hidden or too short. */
const measurePitch = (row: HTMLDivElement | null): number => {
    const items = row?.children;
    if (!items || items.length < 2) return 0;
    return Math.max(0, (items[1] as HTMLElement).offsetLeft - (items[0] as HTMLElement).offsetLeft);
};

/**
 * The frames with more on the end, from the pool in turn, until they run a
 * couple of frames past the right-hand edge.
 */
const toppedUp = (frames: Frame[], reel: ReelState, width: number): Frame[] => {
    if (!reel.pool.length) return frames;
    const need = Math.max(4, Math.ceil(width / (reel.pitch || GUESS_PITCH)) + 2);
    const out = [...frames];
    while (out.length < need) {
        out.push({ id: reel.nextId++, url: reel.pool[reel.cursor++ % reel.pool.length] });
    }
    return out;
};

/**
 * A strip of film running across the screen: a row of stills between two
 * sprocket-holed margins, travelling slowly leftwards at the one pace every
 * reel shares (see `useMarquee`).
 *
 * It is one continuous strip rather than a loop: frames leave on the left and
 * new ones join on the right, drawn from `stills` in turn. Give it new stills
 * and the strip keeps going — the new ones join next, and the frames already
 * showing see themselves out. Reduced motion holds it still, and shows the
 * new stills at once.
 */
const FilmReel: React.FC<FilmReelProps> = ({
    stills,
    frameClass = 'h-16 sm:h-28 lg:h-32',
    sprocketClass = 'h-3 sm:h-4',
    className = '',
}) => {
    const still = prefersReducedMotion();
    const viewport = useRef<HTMLDivElement>(null);
    const row = useRef<HTMLDivElement>(null);
    const reel = useRef<ReelState>({
        pool: [],
        cursor: 0,
        nextId: 0,
        offset: 0,
        pitch: 0,
        dropping: false,
    });
    const [frames, setFrames] = useState<Frame[]>([]);
    const [failed, setFailed] = useState<Set<string>>(() => new Set());

    // New stills: keep what's on screen, replace what's waiting off the edge.
    const key = stills.join('|');
    useEffect(() => {
        const r = reel.current;
        r.pool = key ? key.split('|').filter((url) => url && !url.includes('N/A')) : [];
        r.cursor = 0;
        const width = viewport.current?.clientWidth ?? 0;
        setFrames((prev) =>
            toppedUp(
                still || !r.pitch ? [] : prev.filter((_, i) => i * r.pitch - r.offset < width),
                r,
                width
            )
        );
    }, [key, still]);

    // After each change to the row: measure it, settle a frame that has just
    // left, and make sure there are enough frames to reach the far edge.
    useLayoutEffect(() => {
        const r = reel.current;
        r.pitch = measurePitch(row.current) || r.pitch;
        if (r.dropping) {
            r.offset = Math.max(0, r.offset - r.pitch);
            r.dropping = false;
        }
        if (row.current) row.current.style.transform = `translate3d(${-r.offset}px, 0, 0)`;
        const width = viewport.current?.clientWidth ?? 0;
        const more = toppedUp(frames, r, width);
        if (more.length > frames.length) setFrames(more);
    }, [frames]);

    // The travel: a steady drift, and the first frame let go once it's gone.
    useEffect(() => {
        if (still || typeof requestAnimationFrame === 'undefined') return;
        let raf = 0;
        let last = performance.now();
        const step = (now: number) => {
            // A tab in the background comes back where it was, not miles on.
            const seconds = Math.min(0.1, (now - last) / 1000);
            last = now;
            const r = reel.current;
            // A reel that was hidden (the bar's, on a phone) has nothing to
            // measure until it shows; it starts moving once it can.
            if (!r.pitch) r.pitch = measurePitch(row.current);
            if (r.pitch && !r.dropping) {
                r.offset += seconds * MARQUEE_PX_PER_SECOND;
                if (r.offset >= r.pitch) {
                    r.dropping = true;
                    const width = viewport.current?.clientWidth ?? 0;
                    setFrames((prev) => toppedUp(prev.slice(1), r, width));
                }
            }
            if (row.current) row.current.style.transform = `translate3d(${-r.offset}px, 0, 0)`;
            raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [still]);

    if (!key) return null;
    const sprockets = `${sprocketClass} bg-[repeating-linear-gradient(90deg,transparent_0_6px,rgba(242,245,248,0.55)_6px_14px,transparent_14px_22px)] [background-size:22px_55%] [background-position:0_center] bg-repeat-x`;

    return (
        <div
            ref={viewport}
            className={`pointer-events-none w-full overflow-hidden bg-black/85 shadow-2xl ${className}`}
            aria-hidden="true"
        >
            <div className={sprockets} />
            <div ref={row} className="flex w-max gap-1.5 px-1 will-change-transform">
                {frames.map((frame) => (
                    <img
                        key={frame.id}
                        src={frame.url}
                        alt=""
                        decoding="async"
                        // A still that won't load leaves a dark frame, not a gap
                        // that would jolt the strip.
                        className={`aspect-video shrink-0 rounded-[2px] object-cover ${frameClass} ${
                            failed.has(frame.url) ? 'invisible' : ''
                        }`}
                        onError={() => {
                            reel.current.pool = reel.current.pool.filter((u) => u !== frame.url);
                            setFailed((prev) => new Set(prev).add(frame.url));
                        }}
                    />
                ))}
            </div>
            <div className={sprockets} />
        </div>
    );
};

export default FilmReel;
