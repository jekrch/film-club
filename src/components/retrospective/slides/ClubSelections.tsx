import React, { useState } from 'react';
import type { Film } from '../../../types/film';
import type { ClubRetrospective } from '../../../utils/retrospectiveUtils';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { give } from '../../../hooks/useSqueeze';
import { MemberFace } from './shared';
import { FACE_RING, numberWord } from './format';
import PosterHand from './PosterHand';

interface ClubSelectionsProps {
    selections: NonNullable<ClubRetrospective['selections']>;
    accent: string;
    /** Stills for the reel across the top. */
    reel?: string[];
}

/** "1931–1972", or one year for picks all from the same one. */
const yearSpan = (films: Film[]): string | null => {
    const years = films.map((f) => parseInt(f.year, 10)).filter(Number.isFinite);
    if (!years.length) return null;
    const [low, high] = [Math.min(...years), Math.max(...years)];
    return low === high ? String(low) : `${low}–${high}`;
};

/** Seats a row at the widest, by how many are at the table. Literal, for Tailwind. */
const COLUMNS: Record<number, string> = {
    1: 'lg:grid-cols-1',
    2: 'lg:grid-cols-2',
    3: 'lg:grid-cols-3',
};

/** "Ten films between us", "16 films between us". */
const filmsBetweenUs = (n: number): string => {
    const word = numberWord(n);
    return `${word.charAt(0).toUpperCase()}${word.slice(1)} film${n === 1 ? '' : 's'} between us`;
};

/**
 * Who brought what, as a card table: a seat each, with the member's picks
 * held in a fanned hand above their face, under a lamp. Pointing at a seat
 * spreads that hand, and at a poster lifts it out. No scores, and nothing
 * sets one member's picks against another's — a pick isn't a contest.
 */
const ClubSelections: React.FC<ClubSelectionsProps> = ({ selections, accent, reel }) => {
    const [open, setOpen] = useState<string | null>(null);
    const total = selections.reduce((sum, s) => sum + s.films.length, 0);

    return (
        <Slide reel={reel}>
            <Reveal>
                <Eyebrow color={accent}>Who picked what</Eyebrow>
                <h2 className="mt-2 font-serif text-3xl leading-tight text-balance text-slate-50 sm:text-5xl">
                    {filmsBetweenUs(total)}
                </h2>
            </Reveal>
            <div
                className={`grid grid-cols-2 ${COLUMNS[selections.length] ?? 'lg:grid-cols-4'}`}
                style={{
                    marginTop: give('2rem', '0.75rem'),
                    rowGap: give('1.75rem', '0.5rem'),
                }}
            >
                {selections.map(({ selector, films }, i) => {
                    const about = yearSpan(films);
                    return (
                        <Reveal key={selector} step={1 + i * 0.5}>
                            <div
                                className="relative isolate flex flex-col items-center"
                                onMouseEnter={() => setOpen(selector)}
                                onMouseLeave={() => setOpen(null)}
                            >
                                {/* The lamp over their seat: a pool of light on the felt. */}
                                <div
                                    className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto aspect-square max-w-full rounded-full transition-opacity duration-500"
                                    style={{
                                        background: `radial-gradient(closest-side, ${accent}2e, transparent)`,
                                        opacity: open === selector ? 1 : 0.55,
                                    }}
                                    aria-hidden="true"
                                />
                                <PosterHand
                                    films={films}
                                    sizeClass="[--card:3.5rem] sm:[--card:4.5rem]"
                                    open={open === selector}
                                    step={1.5 + i * 0.5}
                                />
                                {/* The face sits just over the bottom of the hand, as if holding it. */}
                                <MemberFace
                                    name={selector}
                                    color={FACE_RING}
                                    size="h-10 w-10 sm:h-12 sm:w-12"
                                    className="relative z-20 -mt-4 bg-page"
                                />
                                <p className="mt-1.5 font-serif text-lg leading-tight text-slate-50 sm:text-xl">
                                    {selector}
                                </p>
                                <p className="text-xs text-slate-400 sm:text-sm">
                                    {films.length} pick{films.length === 1 ? '' : 's'}
                                    {about ? ` · ${about}` : ''}
                                </p>
                            </div>
                        </Reveal>
                    );
                })}
            </div>
        </Slide>
    );
};

export default ClubSelections;
