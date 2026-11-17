import React from 'react';
import { Link } from 'react-router-dom';
import type { RetrospectiveReview } from '../../../utils/retrospectiveUtils';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { MemberFace } from './shared';
import { excerpt, FACE_RING, formatScore, numberWord, writtenOn } from './format';

interface WordsSlideProps {
    /** How many reviews, and the breakdown line under it. */
    count: number;
    detail?: string;
    /**
     * The reviews to quote, already chosen, in the order shown. One with
     * `writtenAt` is a voice from the future, and is labelled as one.
     */
    clips: RetrospectiveReview[];
    /**
     * How many reviews of the year's films were written years later by
     * someone who joined since, beyond `count`.
     */
    fromFuture?: number;
    stillsOf: (imdbID: string) => string[];
    /** "we wrote" for the club, "you wrote" for a member. */
    who: 'we' | 'you';
    accent: string;
    /**
     * Where "see more" goes: the log, or the member's own. Absent for a year
     * before the log, which the slide then doesn't mention.
     */
    moreTo?: string;
}

/**
 * One quoted review: a frame from the film, then who wrote it and their words.
 * A review from the future says so, and when it was written, above the frame.
 */
const Clip: React.FC<{
    review: RetrospectiveReview;
    still?: string;
    writtenAt?: string;
    accent: string;
}> = ({ review, still, writtenAt, accent }) => {
    return (
        <figure className="border-t border-slate-100/15 pt-3">
            {writtenAt && (
                <p className="mb-2 font-serif text-sm italic" style={{ color: accent }}>
                    A voice from the future · {writtenOn(writtenAt)}
                </p>
            )}
            {/* The frame is what gives when the slide is short of room:
                cropped shorter, never scaled. */}
            <div className="retro-give-aspect relative bg-slate-900 [--aspect:21/9] [--aspect-tight:21/5]">
                {still && <img src={still} alt="" className="h-full w-full object-cover" />}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                <p className="absolute right-3 bottom-2 left-3 truncate font-serif text-sm text-slate-100 italic">
                    {review.title}
                </p>
            </div>
            <figcaption className="mt-3 flex items-center gap-2 text-sm">
                <MemberFace name={review.member} color={FACE_RING} size="h-6 w-6" />
                <span className="font-medium text-slate-100">{review.member}</span>
                {review.score !== null && (
                    <span className="text-slate-500">{formatScore(review.score)}</span>
                )}
            </figcaption>
            <blockquote className="mt-2 font-serif text-base leading-snug text-slate-100 sm:text-lg">
                “{excerpt(review.blurb, 170)}”
            </blockquote>
        </figure>
    );
};

/**
 * The year in words: how many reviews, and a handful of them side by side,
 * each the same size, so no one writer is set above the rest.
 */
const WordsSlide: React.FC<WordsSlideProps> = ({
    count,
    detail,
    clips,
    fromFuture = 0,
    stillsOf,
    who,
    accent,
    moreTo,
}) => (
    <Slide>
        <Reveal>
            <Eyebrow color={accent}>{who === 'we' ? 'What we wrote' : 'What you wrote'}</Eyebrow>
            <p className="mt-2 text-lg text-slate-300 sm:text-xl">
                {numberWord(count).replace(/^./, (c) => c.toUpperCase())} review
                {count === 1 ? '' : 's'} this year.
                {detail ? <span className="text-slate-400"> {detail}.</span> : null}
                {fromFuture ? (
                    <span className="text-slate-400">
                        {' '}
                        And {numberWord(fromFuture)} from the future.
                    </span>
                ) : null}
            </p>
        </Reveal>
        <div className="mt-6 grid gap-x-6 gap-y-5 sm:grid-cols-2">
            {clips.map((review, i) => (
                <Reveal key={review.threadId} step={1 + i * 0.5}>
                    <Clip
                        review={review}
                        // A film quoted already gets another of its frames.
                        still={
                            stillsOf(review.imdbID)[
                                clips.slice(0, i).some((c) => c.imdbID === review.imdbID) ? 1 : 0
                            ] ?? stillsOf(review.imdbID)[0]
                        }
                        writtenAt={review.writtenAt}
                        accent={accent}
                    />
                </Reveal>
            ))}
        </div>
        {moreTo && (
            <Reveal step={1 + clips.length * 0.5}>
                <Link
                    to={moreTo}
                    className="mt-5 inline-block text-sm font-medium hover:underline"
                    style={{ color: accent }}
                >
                    See more on the log →
                </Link>
            </Reveal>
        )}
    </Slide>
);

export default WordsSlide;
