import React from 'react';
import { Link } from 'react-router-dom';
import { getTeamMemberByName } from '../../../types/team';
import type { RetrospectiveReview } from '../../../utils/retrospectiveUtils';
import CircularImage from '../../common/CircularImage';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { excerpt, memberColor, numberWord } from './format';

interface WordsSlideProps {
    /** How many reviews, and the breakdown line under it. */
    count: number;
    detail?: string;
    /** The reviews to quote, already chosen. */
    clips: RetrospectiveReview[];
    stillsOf: (imdbID: string) => string[];
    /** "we wrote" for the club, "you wrote" for a member. */
    who: 'we' | 'you';
    accent: string;
    /** Where "see more" goes: the log, or the member's own. */
    moreTo: string;
}

/** One quoted review: a frame from the film, the writer's face, their words. */
const Clip: React.FC<{ review: RetrospectiveReview; still?: string; accent: string }> = ({
    review,
    still,
    accent,
}) => {
    const member = getTeamMemberByName(review.member);
    const color = member ? memberColor(member) : accent;
    return (
        <figure className="overflow-hidden rounded-md bg-slate-950/70 shadow-xl ring-1 ring-slate-100/10">
            <div className="retro-give-aspect relative bg-slate-900 [--aspect:21/9] [--aspect-tight:21/5]">
                {still && (
                    <img src={still} alt="" className="h-full w-full object-cover opacity-80" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                <p className="absolute bottom-2 left-3 right-3 truncate font-serif text-sm italic text-slate-200">
                    {review.title}
                </p>
            </div>
            <div className="relative px-4 pt-1 pb-4">
                <div
                    className="absolute -top-6 right-3 rounded-full p-0.5"
                    style={{ boxShadow: `0 0 0 2px ${color}` }}
                >
                    <CircularImage alt={review.member} size="h-11 w-11" className="!border-0" />
                </div>
                <figcaption
                    className="text-xs font-semibold uppercase tracking-[0.18em]"
                    style={{ color }}
                >
                    {review.member}
                </figcaption>
                <blockquote className="mt-2 font-serif text-base leading-snug text-slate-100 sm:text-lg">
                    “{excerpt(review.blurb, 170)}”
                </blockquote>
            </div>
        </figure>
    );
};

/** The year in words: how many reviews, and a handful of them, each with its writer. */
const WordsSlide: React.FC<WordsSlideProps> = ({
    count,
    detail,
    clips,
    stillsOf,
    who,
    accent,
    moreTo,
}) => (
    <Slide>
        <Reveal>
            <Eyebrow color={accent}>In our own words</Eyebrow>
            <p className="mt-3 text-lg text-slate-300 sm:text-xl">
                {who === 'we' ? 'We' : 'You'} wrote{' '}
                <span className="font-serif text-slate-50">
                    {numberWord(count)} review{count === 1 ? '' : 's'}
                </span>
                {detail ? <span className="text-slate-400"> — {detail}</span> : null}
            </p>
        </Reveal>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {clips.map((review, i) => (
                <Reveal key={review.threadId} step={1 + i * 0.5}>
                    <Clip review={review} still={stillsOf(review.imdbID)[0]} accent={accent} />
                </Reveal>
            ))}
        </div>
        <Reveal step={1 + clips.length * 0.5}>
            <Link
                to={moreTo}
                className="mt-5 inline-block text-sm font-medium hover:underline"
                style={{ color: accent }}
            >
                See more on the log →
            </Link>
        </Reveal>
    </Slide>
);

export default WordsSlide;
