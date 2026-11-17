import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { prefersReducedMotion } from '../../utils/motion';

interface StillsBackdropProps {
    /** Scene stills of the film (or films) the slide is about. */
    images: string[];
    /** How strongly they show, 0–1. */
    strength?: number;
    /**
     * Where the frames are darkened for the words: from the left and the
     * bottom, or along the bottom alone, for a slide that sets its words low
     * and lets the frame have the rest.
     */
    scrim?: 'side' | 'bottom';
}

/** How long each still holds before the next fades in. */
const HOLD_MS = 5500;
/** How long a still takes to dissolve in over the last. */
const FADE_S = 1.6;

/**
 * A featured film's stills behind its slide: one at a time, each pushing in
 * slowly while it holds and dissolving into the next — a slow cinema trailer
 * for the film the slide is talking about.
 *
 * Darkened from the left and the bottom, where the copy sits, so the words stay
 * readable over any frame. Reduced motion holds the first still.
 */
const StillsBackdrop: React.FC<StillsBackdropProps> = ({
    images,
    strength = 0.5,
    scrim = 'side',
}) => {
    const [index, setIndex] = useState(0);
    const [failed, setFailed] = useState<Set<string>>(() => new Set());
    const usable = images.filter((url) => !failed.has(url));
    const still = prefersReducedMotion();

    useEffect(() => {
        if (still || usable.length < 2) return;
        const timer = window.setInterval(() => setIndex((i) => i + 1), HOLD_MS);
        return () => window.clearInterval(timer);
    }, [still, usable.length]);

    if (!usable.length) return null;
    const url = usable[index % usable.length];
    const next = usable[(index + 1) % usable.length];

    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            {/* Each still dissolves in over the last, which stays at full
                strength beneath it, still pushing in, until it's covered: no
                dip in the middle and no move stopping dead. The strength is
                set once on the whole stack rather than on each frame, so a
                still that has faded in is opaque within it and fully hides
                the one beneath before that one is dropped. Dimming each frame
                instead would leave the old one showing through the new, then
                vanishing in a blink when it's removed. */}
            <div className="absolute inset-0" style={{ opacity: strength }}>
                <AnimatePresence initial={false}>
                    <motion.div
                        key={url}
                        className="absolute inset-0"
                        initial={{ opacity: 0 }}
                        animate={{
                            opacity: 1,
                            transition: { duration: still ? 0 : FADE_S, ease: 'easeInOut' },
                        }}
                        exit={{
                            opacity: 0,
                            // Gone only once the next is fully over it.
                            transition: { delay: still ? 0 : FADE_S + 0.15, duration: 0 },
                        }}
                    >
                        <motion.img
                            src={url}
                            alt=""
                            className="h-full w-full object-cover"
                            initial={{ scale: still ? 1.04 : 1.1 }}
                            animate={{ scale: still ? 1.04 : 1.0 }}
                            transition={{
                                duration: still ? 0 : HOLD_MS / 1000 + FADE_S * 2,
                                ease: 'linear',
                            }}
                            onError={() => setFailed((prev) => new Set(prev).add(url))}
                        />
                    </motion.div>
                </AnimatePresence>
            </div>
            {/* Warm the next frame so it doesn't arrive half-drawn. */}
            {next !== url && <link rel="preload" as="image" href={next} />}
            {scrim === 'side' ? (
                <>
                    <div className="absolute inset-0 bg-gradient-to-r from-page via-page/70 to-page/10" />
                    <div className="absolute inset-0 bg-gradient-to-t from-page via-transparent to-page/60" />
                </>
            ) : (
                <>
                    <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-page via-page/75 to-transparent" />
                    <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-page/70 to-transparent" />
                </>
            )}
        </div>
    );
};

export default StillsBackdrop;
