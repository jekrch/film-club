import React from 'react';
import { motion, type Easing } from 'framer-motion';
import { Link } from 'react-router-dom';
import { prefersReducedMotion } from '../../../utils/motion';
import type { ClubRetrospective } from '../../../utils/retrospectiveUtils';
import CircularImage from '../../common/CircularImage';
import Slide, { Eyebrow } from '../Slide';
import { MONTHS } from './format';

interface ClubWelcomeProps {
    year: number;
    welcome: NonNullable<ClubRetrospective['welcomes']>[number];
    accent: string;
}

/**
 * The card's timeline, in seconds. Slower than the other slides' quick
 * reveal on purpose: the line is read in full, a beat of nothing, then the
 * face rolls in, and only once it has settled does the name follow.
 */
const AT = {
    eyebrow: 0.3,
    line: 0.6,
    face: 2.0,
    name: 4.7,
    film: 5.2,
} as const;

/**
 * How far the face rolls in from, and how far it turns on the way: about what
 * a wheel its size would turn over that distance, so it reads as rolling
 * rather than spinning.
 */
const ROLL_FROM = -450;
const ROLL_TURN = -400;

/**
 * The roll itself: a slow coast that eases to a stop just past centre, then
 * one soft rock back and a smaller one forward before it rests. The overshoot
 * and its turn are kept in the same wheel ratio as the roll, so the rock
 * reads as the face teetering rather than sliding.
 */
const ROLL_S = 3.0;
const ROLL_TIMES = [0, 0.68, 0.86, 1];
const ROLL_EASE: Easing[] = [[0.25, 0.6, 0.3, 1], 'easeInOut', 'easeInOut'];
const ROLL_X = [ROLL_FROM, 12, -4, 0];
const ROLL_ROTATE = [ROLL_TURN, 10, -3.5, 0];
const ROLL = { duration: ROLL_S, times: ROLL_TIMES, ease: ROLL_EASE, delay: AT.face };

/** Fades up into place at `at` seconds, or simply is there for reduced motion. */
const Arrive: React.FC<{
    at: number;
    duration?: number;
    rise?: number;
    children: React.ReactNode;
}> = ({ at, duration = 0.5, rise = 8, children }) => (
    <motion.div
        initial={prefersReducedMotion() ? false : { opacity: 0, y: rise }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration, delay: at, ease: 'easeOut' }}
    >
        {children}
    </motion.div>
);

/**
 * A card for someone who arrived this year: the line that greets them, their
 * face rolling in from the side to settle under it, and the first club film
 * they scored, which the deck plays behind it.
 */
const ClubWelcome: React.FC<ClubWelcomeProps> = ({ year, welcome, accent }) => {
    const { member, line, first } = welcome;
    const date = first?.parsedWatchDate;
    const still = prefersReducedMotion();
    return (
        <Slide className="text-center">
            <Arrive at={AT.eyebrow} rise={0}>
                <Eyebrow color={accent}>New in {year}</Eyebrow>
            </Arrive>
            <Arrive at={AT.line} duration={0.9} rise={14}>
                <h2 className="mt-4 font-serif text-4xl leading-tight text-balance text-slate-50 sm:text-6xl">
                    {line}
                </h2>
            </Arrive>
            {/* Clipped across, so the slide doesn't scroll sideways while the
            face is still off to the left; the ring's edge stays clear above
            and below. */}
            <div className="mt-8 overflow-x-clip">
                <motion.div
                    className="mx-auto w-fit rounded-full p-1"
                    style={{ boxShadow: `0 0 0 2px ${accent}` }}
                    initial={still ? false : { x: ROLL_FROM, rotate: ROLL_TURN, opacity: 0 }}
                    animate={
                        still
                            ? { x: 0, rotate: 0, opacity: 1 }
                            : { x: ROLL_X, rotate: ROLL_ROTATE, opacity: 1 }
                    }
                    transition={{
                        x: ROLL,
                        rotate: ROLL,
                        opacity: { duration: 0.4, delay: AT.face },
                    }}
                >
                    <CircularImage
                        src={member.image}
                        alt={member.name}
                        size="w-28 h-28 sm:w-36 sm:h-36"
                    />
                </motion.div>
            </div>
            <Arrive at={AT.name}>
                <p className="mt-4 font-serif text-2xl text-slate-100 sm:text-3xl">{member.name}</p>
                {member.title && (
                    <p className="mt-1 text-sm text-slate-400 sm:text-base">{member.title}</p>
                )}
            </Arrive>
            {first && date && (
                <Arrive at={AT.film}>
                    <p className="mt-8 text-slate-400">
                        First screening:{' '}
                        <Link
                            to={`/films/${first.imdbID}`}
                            className="font-serif text-slate-200 hover:underline"
                        >
                            {first.title}
                        </Link>
                        , {MONTHS[date.getUTCMonth()]} {date.getUTCDate()}
                    </p>
                </Arrive>
            )}
        </Slide>
    );
};

export default ClubWelcome;
