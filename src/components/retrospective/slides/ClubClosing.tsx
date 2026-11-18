import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { prefersReducedMotion } from '../../../utils/motion';
import type { Film } from '../../../types/film';
import type { TeamMember } from '../../../types/team';
import CircularImage from '../../common/CircularImage';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { FACE_RING, numberWord, retrospectivePath } from './format';

interface ClubClosingProps {
    year: number;
    /** The year isn't over, so the one after it is still to come. */
    inProgress: boolean;
    /** The next year with a report after this one, or null when there's none yet. */
    following: number | null;
    /** Everyone with the club this year. */
    roster: TeamMember[];
    /** Those on the roster with a report of their own; the rest aren't links. */
    reports: TeamMember[];
    guests: { member: TeamMember; films: Film[] }[];
    accent: string;
    /** Stills for the reel across the top. */
    reel?: string[];
}

type Guest = ClubClosingProps['guests'][number];

/** "Greg, our intern," — who a guest is, the first of their two lines. */
const guestName = ({ member }: Guest): string =>
    member.title ? `${member.name}, our ${member.title.toLowerCase()},` : member.name;

/** "who sat in on The Odyssey" — why they're thanked, the second. */
const guestSat = ({ films }: Guest): string =>
    `who sat in on ${films.length === 1 ? films[0].title : `${numberWord(films.length)} screenings`}`;

/**
 * When the first guest's face pops up, in seconds: after "With thanks to" has
 * sat on its own for a moment, so the face lands as the punchline. Each guest
 * after waits a little longer.
 */
const PEEK_AT = 1.3;
const PEEK_STAGGER = 0.4;

/** How far the face stays tucked behind the ledge once it's up, chin hidden. */
const TUCK = '14%';

/**
 * A guest's face peeking up over a ledge, like someone ducking up from behind
 * a wall: it pops up a touch too high, sinks back with its chin behind the
 * ledge, then tips its head one way and the other and stays cocked.
 *
 * The clip is on the bottom edge only. The head tips from its neck, below the
 * ledge, so the top of it swings well out to the sides; clipping those would
 * shave the face as it turns.
 */
const GuestPeek: React.FC<{ guest: Guest; at: number }> = ({ guest, at }) => {
    const still = prefersReducedMotion();
    return (
        <div className="flex flex-col items-center">
            <div style={{ clipPath: 'inset(-100% -100% 0 -100%)' }} aria-hidden="true">
                <motion.div
                    className="rounded-full p-0.5"
                    style={{ boxShadow: `0 0 0 2px ${FACE_RING}`, originY: 1 }}
                    initial={still ? false : { y: '110%', rotate: 0 }}
                    animate={
                        still
                            ? { y: TUCK, rotate: -7 }
                            : { y: ['110%', '-6%', TUCK], rotate: [0, 0, 11, -9, -7] }
                    }
                    transition={{
                        y: {
                            duration: 0.75,
                            times: [0, 0.55, 1],
                            ease: ['easeOut', 'easeInOut'],
                            delay: at,
                        },
                        rotate: {
                            duration: 1.8,
                            times: [0, 0.3, 0.52, 0.76, 1],
                            ease: 'easeInOut',
                            delay: at + 0.5,
                        },
                    }}
                >
                    <CircularImage alt={guest.member.name} size="w-12 h-12 sm:w-14 sm:h-14" />
                </motion.div>
            </div>
            {/* The ledge: a hairline that fades out at either end. */}
            <div
                className="h-px w-24 sm:w-28"
                style={{
                    background: `linear-gradient(to right, transparent, ${FACE_RING}, transparent)`,
                }}
            />
            <motion.div
                initial={still ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: at + 0.6, ease: 'easeOut' }}
            >
                <p className="mt-3 font-serif text-lg text-slate-200 sm:text-xl">
                    {guestName(guest)}
                </p>
                <p className="mt-0.5 font-serif text-sm italic text-slate-400 sm:text-base">
                    {guestSat(guest)}
                </p>
            </motion.div>
        </div>
    );
};

/**
 * See you next year — only for the year still running; a past year's after it
 * has come and gone, so that one points on to it instead — and a door into each
 * member's own report.
 */
const ClubClosing: React.FC<ClubClosingProps> = ({
    year,
    inProgress,
    following,
    roster,
    reports,
    guests,
    accent,
    reel,
}) => (
    <Slide reel={reel} className="text-center">
        <Reveal>
            <Eyebrow color={accent}>The Criterion Club</Eyebrow>
            <h2 className="mt-4 font-serif text-5xl text-slate-50 sm:text-7xl">
                {inProgress ? `See you in ${year + 1}` : `That was ${year}`}
            </h2>
            {!inProgress && following !== null && (
                <Link
                    to={retrospectivePath(following)}
                    className="mt-5 inline-block font-serif text-lg italic underline-offset-4 hover:underline sm:text-xl"
                    style={{ color: accent }}
                >
                    On to {following} →
                </Link>
            )}
        </Reveal>
        {roster.length > 0 && (
            <Reveal step={1}>
                <p className="mt-8 text-sm text-slate-400 sm:text-base">Everyone's own year</p>
                <div className="mt-4 flex flex-wrap justify-center gap-5 sm:gap-8">
                    {roster.map((member) => {
                        const face = (
                            <>
                                <div
                                    className="rounded-full p-0.5"
                                    style={{ boxShadow: `0 0 0 2px ${FACE_RING}` }}
                                >
                                    <CircularImage
                                        alt={member.name}
                                        size="w-14 h-14 sm:w-16 sm:h-16"
                                    />
                                </div>
                                <span className="text-sm font-medium text-slate-100">
                                    {member.name}
                                </span>
                            </>
                        );
                        return reports.includes(member) ? (
                            <Link
                                key={member.name}
                                to={retrospectivePath(year, member.name)}
                                className="group flex flex-col items-center gap-2"
                            >
                                {face}
                            </Link>
                        ) : (
                            <div key={member.name} className="flex flex-col items-center gap-2">
                                {face}
                            </div>
                        );
                    })}
                </div>
            </Reveal>
        )}
        {guests.length > 0 && (
            <Reveal step={2}>
                <p className="mt-10 font-serif text-sm italic text-slate-500 sm:text-base">
                    With thanks to
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-x-10 gap-y-6">
                    {guests.map((guest, i) => (
                        <GuestPeek
                            key={guest.member.name}
                            guest={guest}
                            at={PEEK_AT + i * PEEK_STAGGER}
                        />
                    ))}
                </div>
            </Reveal>
        )}
    </Slide>
);

export default ClubClosing;
