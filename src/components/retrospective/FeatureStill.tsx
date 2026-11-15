import React, { useEffect, useId, useState } from 'react';
import { AnimatePresence, motion, type TargetAndTransition } from 'framer-motion';
import { prefersReducedMotion } from '../../utils/motion';

interface FeatureStillProps {
    stills: string[];
    /** The colour the current frame's thumbnail is marked in. */
    accent?: string;
    /** A caption under the frame — usually the film's title. */
    caption?: React.ReactNode;
    /**
     * The frame's shape, as `--aspect` and `--aspect-tight`: its proportions
     * with room to spare and when its slide is squeezed for height (see
     * `.retro-give-aspect`). 16:9 giving to 16:6 unless a slide says otherwise.
     */
    aspectClass?: string;
    /** Small, fixed-size thumbnails in a row, rather than ones that share the frame's width. */
    compactRail?: boolean;
    className?: string;
}

/** How long each frame holds once it's in. */
const HOLD_MS = 4200;
/** How long a frame takes to dissolve in over the last. */
const REVEAL_S = 1.4;
/** A long, even ease in and out: no frame snaps in or stops dead. */
const DISSOLVE: [number, number, number, number] = [0.45, 0, 0.25, 1];
/** How the rail's thumbnails and highlight glide when the frame moves on. */
const GLIDE = { type: 'spring', stiffness: 260, damping: 32, mass: 0.9 } as const;
/** Thumbnails under the frame, at most. */
const RAIL = 6;
/** Thumbnails in a compact rail, which are small enough to fit more. */
const COMPACT_RAIL = 8;

/**
 * The camera move each frame makes while it holds — a slow push in, a drift
 * back, a pan each way — taken in turn, so no two frames in a row move the
 * same way. Kept small, the way a documentary moves over a photograph, and
 * scaled up enough throughout that the frame's edges never show.
 */
const MOVES: { from: TargetAndTransition; to: TargetAndTransition }[] = [
    { from: { scale: 1.06, x: '-1.5%', y: '-1%' }, to: { scale: 1.14, x: '1%', y: '0.5%' } },
    { from: { scale: 1.14, x: '1.5%', y: '0%' }, to: { scale: 1.06, x: '-1%', y: '0%' } },
    { from: { scale: 1.1, x: '-2.5%', y: '0%' }, to: { scale: 1.1, x: '2.5%', y: '0%' } },
    { from: { scale: 1.08, x: '1%', y: '1.5%' }, to: { scale: 1.12, x: '-1%', y: '-1.5%' } },
];

/** Grain, drawn once as an SVG noise tile. */
const GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>'
)}")`;

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * A film's frames shown large, the way a projectionist might run them: each
 * frame with its own slow camera move, dissolving in over the last while that
 * one is still moving, under a little grain and a frame counter. A rail of the
 * frames runs beneath, the current one filling as it plays, its highlight
 * gliding along as the frames move on; any of them can be clicked to go
 * straight to it. Reduced motion keeps the changes as cuts and drops the
 * movement.
 */
const FeatureStill: React.FC<FeatureStillProps> = ({
    stills,
    accent = '#ccd5e0',
    caption,
    aspectClass = '[--aspect:16/9] [--aspect-tight:16/6]',
    compactRail = false,
    className = '',
}) => {
    const [index, setIndex] = useState(0);
    const [failed, setFailed] = useState<Set<string>>(() => new Set());
    const usable = stills.filter((url) => url && !failed.has(url));
    const still = prefersReducedMotion();
    const railId = useId();
    const count = usable.length;
    const current = count ? index % count : 0;

    useEffect(() => {
        if (still || count < 2) return;
        const timer = window.setTimeout(() => setIndex((i) => i + 1), HOLD_MS + REVEAL_S * 1000);
        return () => window.clearTimeout(timer);
    }, [still, count, index]);

    if (!count) return null;
    const url = usable[current];
    const move = MOVES[index % MOVES.length];
    // The rail shows a window of frames around the current one.
    const railLength = compactRail ? COMPACT_RAIL : RAIL;
    const railStart = Math.max(0, Math.min(current - 2, count - railLength));
    const rail = usable.slice(railStart, railStart + railLength);

    /** Forward to a frame, so the cuts and camera moves carry on in turn. */
    const cutTo = (at: number) =>
        setIndex((n) => n + ((at - (n % count) + count) % count || count));

    return (
        <figure className={className}>
            <div
                className={`retro-give-aspect relative w-full overflow-hidden rounded-sm bg-black shadow-2xl ring-1 ring-slate-100/15 ${aspectClass}`}
            >
                <AnimatePresence initial={false}>
                    <motion.div
                        key={`${index}-${url}`}
                        className="absolute inset-0 overflow-hidden"
                        initial={{ opacity: 0 }}
                        animate={{
                            opacity: 1,
                            transition: { duration: still ? 0 : REVEAL_S, ease: DISSOLVE },
                        }}
                        // The outgoing frame stays at full strength underneath,
                        // still moving, until the new one has fully arrived over
                        // it: a true dissolve, with no dip to black between.
                        exit={{
                            opacity: 0,
                            transition: { delay: still ? 0 : REVEAL_S, duration: 0.01 },
                        }}
                    >
                        <motion.img
                            src={url}
                            alt=""
                            className="h-full w-full object-cover"
                            initial={still ? false : move.from}
                            animate={still ? undefined : move.to}
                            transition={{
                                duration: (HOLD_MS + REVEAL_S * 2000) / 1000,
                                ease: 'linear',
                            }}
                            onError={() => setFailed((prev) => new Set(prev).add(url))}
                        />
                    </motion.div>
                </AnimatePresence>

                {/* Grain and a soft vignette, the texture of a projected print. */}
                <div
                    className="retro-grain pointer-events-none absolute -inset-[10%] opacity-[0.09] mix-blend-overlay"
                    style={{ backgroundImage: GRAIN }}
                    aria-hidden="true"
                />
                <div
                    className="pointer-events-none absolute inset-0 shadow-[inset_0_0_80px_rgba(0,0,0,0.55)]"
                    aria-hidden="true"
                />
                {count > 1 && (
                    <span className="pointer-events-none absolute right-2 bottom-1.5 font-mono text-[10px] tracking-[0.2em] text-slate-100/70">
                        {pad(current + 1)} / {pad(count)}
                    </span>
                )}
            </div>

            {count > 1 && (
                <div className="mt-1.5 flex gap-1 overflow-hidden">
                    <AnimatePresence initial={false} mode="popLayout">
                        {rail.map((frame, i) => {
                            const at = railStart + i;
                            const active = at === current;
                            return (
                                <motion.button
                                    key={`${frame}-${at}`}
                                    layout={!still}
                                    initial={still ? false : { opacity: 0, scale: 0.92 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.92 }}
                                    transition={still ? { duration: 0 } : GLIDE}
                                    type="button"
                                    onClick={() => !active && cutTo(at)}
                                    className={`group relative aspect-video min-w-0 overflow-hidden rounded-[2px] ${
                                        compactRail ? 'w-9 flex-none sm:w-11' : 'flex-1'
                                    }`}
                                    aria-label={`Frame ${at + 1} of ${count}`}
                                    aria-current={active || undefined}
                                >
                                    <img
                                        src={frame}
                                        alt=""
                                        className={`h-full w-full object-cover transition-opacity duration-700 ease-out ${
                                            active
                                                ? 'opacity-100'
                                                : 'opacity-45 group-hover:opacity-80'
                                        }`}
                                    />
                                    {/* The highlight is one element that moves
                                        from frame to frame, rather than a ring
                                        that blinks off one and on the next. */}
                                    {active && (
                                        <motion.span
                                            layoutId={still ? undefined : `${railId}-current`}
                                            transition={GLIDE}
                                            className="pointer-events-none absolute inset-0 rounded-[2px]"
                                            style={{ boxShadow: `inset 0 0 0 1.5px ${accent}` }}
                                        />
                                    )}
                                    {active && !still && (
                                        <span
                                            key={index}
                                            className="absolute inset-x-0 bottom-0 h-0.5 origin-left"
                                            style={{
                                                backgroundColor: accent,
                                                animation: `retro-progress ${HOLD_MS + REVEAL_S * 1000}ms linear forwards`,
                                            }}
                                        />
                                    )}
                                </motion.button>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}

            {caption && (
                <figcaption className="mt-2 font-sans text-xs uppercase tracking-[0.18em] text-slate-500">
                    {caption}
                </figcaption>
            )}
        </figure>
    );
};

export default FeatureStill;
