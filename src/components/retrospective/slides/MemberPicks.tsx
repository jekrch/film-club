import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import type { Film } from '../../../types/film';
import type { MemberRetrospective } from '../../../utils/retrospectiveUtils';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { give } from '../../../hooks/useSqueeze';
import { prefersReducedMotion } from '../../../utils/motion';
import { beat, formatScore, MONTHS, numberWord } from './format';
import PosterHand from './PosterHand';

interface MemberPicksProps {
    picks: Film[];
    bestPick: MemberRetrospective['bestPick'];
    accent: string;
}

/** "Screened March 14", from the sheet's "3/14/2026"; nothing for a date it can't read. */
const screenedOn = (watchDate: string | null | undefined): string | null => {
    const match = watchDate?.match(/^(\d{1,2})\/(\d{1,2})\/\d{4}/);
    const month = match ? MONTHS[Number(match[1]) - 1] : undefined;
    return month ? `screened ${month} ${Number(match![2])}` : null;
};

/** The first director named, for a line that has room for one. */
const directorOf = (film: Film): string | null => {
    const name = film.director?.split(',')[0]?.trim();
    return name && name !== 'N/A' ? name : null;
};

/**
 * The films they brought to the club, dealt out as a fanned hand of posters
 * with a programme note for each beside it. Pointing at a note lifts its
 * poster out of the hand. No scores, save the one line under a pick that drew
 * the highest average of any they've made in all their years, whose poster
 * is lit in the accent.
 */
const MemberPicks: React.FC<MemberPicksProps> = ({ picks, bestPick, accent }) => {
    const best = new Set(bestPick?.films.map((f) => f.imdbID));
    const [lifted, setLifted] = useState<number | null>(null);
    const still = prefersReducedMotion();
    const count = picks.length;
    // A lone pick stands larger, with no hand to fan.
    const sizes =
        count === 1
            ? '[--card:9rem] sm:[--card:11rem]'
            : '[--card:7rem] sm:[--card:9rem] lg:[--card:10rem]';

    return (
        <Slide>
            <Reveal>
                <Eyebrow color={accent}>Your picks</Eyebrow>
                <h2 className="mt-2 font-serif text-3xl leading-tight text-balance text-slate-50 sm:text-5xl">
                    You brought{' '}
                    <em className="not-italic" style={{ color: accent }}>
                        {numberWord(count)}
                    </em>{' '}
                    film{count === 1 ? '' : 's'} to the club
                </h2>
            </Reveal>

            <div
                className="flex flex-col items-center lg:flex-row lg:items-center lg:gap-12"
                style={{ marginTop: give('2.25rem', '1rem'), gap: give('2rem', '1rem') }}
            >
                <PosterHand
                    films={picks}
                    sizeClass={sizes}
                    lifted={lifted}
                    onLift={setLifted}
                    lit={(film) => !!bestPick && best.has(film.imdbID)}
                    accent={accent}
                    className="shrink-0 pb-4"
                />

                {/* The programme: a note for each film, in the hand's order. */}
                <ol className="w-full min-w-0 flex-1">
                    {picks.map((film, i) => {
                        const isBest = !!bestPick && best.has(film.imdbID);
                        const details = [
                            film.year.slice(0, 4),
                            directorOf(film) && `dir. ${directorOf(film)}`,
                            screenedOn(film.movieClubInfo?.watchDate),
                        ].filter(Boolean);
                        return (
                            <motion.li
                                key={film.imdbID}
                                className="border-t border-slate-100/10 first:border-t-0 lg:first:border-t"
                                style={{
                                    paddingTop: give('0.75rem', '0.4rem'),
                                    paddingBottom: give('0.75rem', '0.4rem'),
                                }}
                                initial={still ? false : { opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{
                                    duration: 0.45,
                                    delay: beat(2 + i * 0.6),
                                    ease: 'easeOut',
                                }}
                                onMouseEnter={() => setLifted(i)}
                                onMouseLeave={() => setLifted(null)}
                            >
                                <Link
                                    to={`/films/${film.imdbID}`}
                                    className="block font-serif text-xl leading-tight text-slate-50 underline-offset-4 hover:underline sm:text-2xl"
                                >
                                    {film.title}
                                </Link>
                                <p className="mt-1 text-sm text-slate-400">{details.join(' · ')}</p>
                                {isBest && (
                                    <p
                                        className="mt-1.5 text-xs uppercase tracking-widest sm:text-sm"
                                        style={{ color: accent }}
                                    >
                                        {bestPick.tied ? 'Tied for the highest' : 'The highest'}{' '}
                                        average of all your picks · {formatScore(bestPick.average)}
                                    </p>
                                )}
                            </motion.li>
                        );
                    })}
                </ol>
            </div>
        </Slide>
    );
};

export default MemberPicks;
