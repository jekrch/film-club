import React, { useState } from 'react';
import { motion } from 'framer-motion';
import type { Film } from '../../../types/film';
import { prefersReducedMotion } from '../../../utils/motion';
import { beat } from './format';
import { Poster } from './shared';

/**
 * Where the hand is held: the point every poster in it turns about, as a
 * share of a poster's height from its top. Well below the posters, so a
 * turn moves each one aside as well as tilting it.
 */
const PIVOT = 2.6;

/** How far a pivot sits from a poster's centre, in poster widths (posters are 2:3). */
const REACH = (PIVOT - 0.5) * 1.5;

/** Degrees between neighbours: wide for two, closing up so a big hand stays within 12° a side. */
const fanStep = (count: number): number => (count === 2 ? 13 : Math.min(10, 24 / (count - 1)));

/** How much wider than its own posters a fan opened `open` times as far stands each side, in poster widths. */
const fanReach = (count: number, open: number): number => {
    if (count < 2) return 0;
    const outer = (((count - 1) / 2) * fanStep(count) * open * Math.PI) / 180;
    // The outermost poster's centre moves aside by the pivot's reach; its
    // top corner swings out half a poster's height further.
    return (REACH + 0.75) * Math.sin(outer);
};

interface PosterHandProps {
    films: Film[];
    /**
     * Sets `--card`, a poster's width, at each breakpoint: e.g.
     * `[--card:7rem] sm:[--card:9rem]`. The hand keeps room either side for
     * its fan from it.
     */
    sizeClass: string;
    /** The poster lifted out of the hand, for a caller that lifts them itself. */
    lifted?: number | null;
    onLift?: (index: number | null) => void;
    /** Fan it out further, as a hand is spread to show it. */
    open?: boolean;
    /** A poster to light in the accent. */
    lit?: (film: Film) => boolean;
    accent?: string;
    /** The beat the first poster is dealt on. */
    step?: number;
    className?: string;
}

/** How much further an open hand fans. */
const OPENED = 1.35;

/** The hand fanning out: unhurried, settling with only a breath of overshoot. */
const DEAL = { type: 'spring', visualDuration: 0.6, bounce: 0.12 } as const;

/** A poster lifting or easing aside: quick, and without any bounce to jitter. */
const LIFT = { type: 'spring', visualDuration: 0.32, bounce: 0 } as const;

const pivot = `50% ${PIVOT * 100}%`;

/**
 * Posters held as a hand of cards: every one turns about one pivot well below
 * it, so they splay from a single point and never cross at their own centres,
 * and each lies on the one before it, left to right, as they were dealt. That
 * order never changes: a lifted poster slides up along its own length, out
 * from under the next, rather than jumping through it, and the others ease
 * apart to make room. Dealt from a squared-up pile when it arrives.
 */
const PosterHand: React.FC<PosterHandProps> = ({
    films,
    sizeClass,
    lifted: liftedProp,
    onLift,
    open = false,
    lit,
    accent,
    step = 1,
    className = '',
}) => {
    const [liftedOwn, setLiftedOwn] = useState<number | null>(null);
    const lifted = liftedProp !== undefined ? liftedProp : liftedOwn;
    const lift = (i: number | null) => (onLift ? onLift(i) : setLiftedOwn(i));
    // Once the last poster lands the hand moves at once: the dealing delays
    // are for its arrival only.
    const [dealt, setDealt] = useState(false);
    const still = prefersReducedMotion();

    const count = films.length;
    const middle = (count - 1) / 2;
    const stepAngle = fanStep(count);
    const spreadBy = open ? OPENED : 1;

    return (
        <div
            className={`grid justify-items-center ${sizeClass} ${className}`}
            style={{
                // Room for the fan at its widest, and for a lifted poster.
                paddingInline: `calc(var(--card) * ${fanReach(count, OPENED).toFixed(3)})`,
                paddingTop: 'calc(var(--card) * 0.3)',
            }}
            role="list"
        >
            {films.map((film, i) => {
                const up = lifted === i;
                // The others ease apart a little to make room for it.
                const aside = lifted === null || up ? 0 : i < lifted ? -2 : 2;
                const ring = accent && lit?.(film) ? `0 0 0 2px ${accent}, ` : '';
                return (
                    <motion.div
                        key={film.imdbID}
                        role="listitem"
                        className="relative [grid-area:1/1]"
                        style={{ zIndex: i + 1, transformOrigin: pivot }}
                        initial={still ? false : { opacity: 0, rotate: 0, y: 24 }}
                        animate={{ opacity: 1, rotate: (i - middle) * stepAngle * spreadBy, y: 0 }}
                        transition={
                            still
                                ? { duration: 0 }
                                : { ...DEAL, delay: dealt ? 0 : beat(step + i * 0.5) }
                        }
                        onAnimationComplete={
                            i === count - 1 && !dealt ? () => setDealt(true) : undefined
                        }
                        onHoverStart={() => lift(i)}
                        onHoverEnd={() => lift(null)}
                    >
                        {/* Where the poster rests, which is what the pointer
                        finds it by. It stays put while the poster lifts and
                        its neighbours ease aside, so neither can slide out
                        from under the pointer and hand it to the next poster,
                        which is what set a hand flickering. Positioned
                        before the poster, so the poster still takes clicks. */}
                        <div className="absolute inset-0" aria-hidden="true" />
                        <motion.div
                            className="relative"
                            style={{ transformOrigin: pivot }}
                            animate={{ rotate: aside }}
                            transition={still ? { duration: 0 } : LIFT}
                        >
                            {/* Inside the turn, so "up" is along the poster. */}
                            <motion.div
                                className="relative rounded-sm"
                                style={{ boxShadow: `${ring}0 6px 12px -4px rgba(0,0,0,0.7)` }}
                                animate={{ y: up ? '-16%' : '0%' }}
                                transition={still ? { duration: 0 } : LIFT}
                            >
                                {/* The deeper shadow of a poster held up off the
                                rest, faded in rather than redrawn each frame. */}
                                <motion.div
                                    className="pointer-events-none absolute inset-0 rounded-sm shadow-[0_26px_34px_-12px_rgba(0,0,0,0.85)]"
                                    initial={false}
                                    animate={{ opacity: up ? 1 : 0 }}
                                    transition={still ? { duration: 0 } : LIFT}
                                    aria-hidden="true"
                                />
                                {/* Opaque while its poster loads, as card stock is. */}
                                <div className="relative rounded-sm bg-slate-800">
                                    <Poster
                                        src={film.poster}
                                        title={film.title}
                                        to={`/films/${film.imdbID}`}
                                        steady
                                        className="w-(--card)"
                                    />
                                </div>
                                {/* A sheen, as a light above catches a printed sheet. */}
                                <div
                                    className="pointer-events-none absolute inset-0 rounded-sm bg-linear-to-br from-white/10 via-transparent to-black/25"
                                    aria-hidden="true"
                                />
                            </motion.div>
                        </motion.div>
                    </motion.div>
                );
            })}
        </div>
    );
};

export default PosterHand;
