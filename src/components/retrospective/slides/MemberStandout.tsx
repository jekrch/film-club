import React from 'react';
import { MAX_SCORE } from '../../../utils/ratingEditUtils';
import type {
    FavouriteCategory,
    FavouriteKind,
    MemberStandoutKind,
    Standout,
} from '../../../utils/retrospectiveUtils';
import StandoutSlide from './StandoutSlide';
import { filmOfKind, listNames } from './format';
import { COUNT, RELEASE, SCORE, SHARE, SPREAD, type StandoutCopy } from './standoutScales';

/**
 * A member's record, always against their own other years: their scores, or
 * their own picks. "The room" is the other members that year, as a group: no
 * one is singled out.
 */
const COPY: Record<Exclude<MemberStandoutKind, FavouriteKind>, StandoutCopy> = {
    'highest-score': {
        headline: 'Your most generous year',
        unit: `your average score, out of ${MAX_SCORE}`,
        next: 'highest',
        chart: 'Your average score by year',
        scale: SCORE,
    },
    'lowest-score': {
        headline: 'Your most discerning year',
        unit: `your average score, out of ${MAX_SCORE}`,
        next: 'lowest',
        chart: 'Your average score by year',
        scale: SCORE,
    },
    'picks-loved': {
        headline: 'The year your picks went over best',
        unit: `the club’s average score on your picks, out of ${MAX_SCORE}`,
        next: 'highest',
        chart: 'The club’s average on your picks, by year',
        scale: SCORE,
    },
    'most-countries': {
        headline: 'Your most widely travelled picks',
        unit: 'countries across your picks',
        next: 'most',
        chart: 'Countries in your picks, by year',
        scale: COUNT,
    },
    'most-languages': {
        headline: 'Your most multilingual picks',
        unit: 'languages across your picks',
        next: 'most',
        chart: 'Languages in your picks, by year',
        scale: COUNT,
    },
    'least-english': {
        headline: 'Your least English-speaking picks',
        unit: 'picks not in English',
        next: 'highest share',
        chart: 'Your picks not in English, by year',
        scale: SHARE,
    },
    'least-american': {
        headline: 'Your least American picks',
        unit: 'picks made outside the United States',
        next: 'highest share',
        chart: 'Your picks made outside the US, by year',
        scale: SHARE,
    },
    oldest: {
        headline: 'Your most historical picks',
        unit: 'the average year your picks came out',
        next: 'oldest',
        chart: 'Average release year of your picks',
        scale: RELEASE,
    },
    newest: {
        headline: 'Your most modern picks',
        unit: 'the average year your picks came out',
        next: 'newest',
        chart: 'Average release year of your picks',
        scale: RELEASE,
    },
    agreed: {
        headline: 'The year you were most in step with the room',
        unit: 'points between your score and the room’s average on a film, on average',
        next: 'closest',
        chart: 'Distance from the room by year',
        scale: SPREAD,
    },
    divided: {
        headline: 'The year you most went your own way',
        unit: 'points between your score and the room’s average on a film, on average',
        next: 'furthest',
        chart: 'Distance from the room by year',
        scale: SPREAD,
    },
    longest: {
        headline: 'Your longest picks',
        unit: 'minutes a pick, on average',
        next: 'longest',
        chart: 'Average runtime of your picks',
        scale: COUNT,
    },
};

/**
 * Their best score on one kind of film, set against their best on it in other
 * years, or, when they'd never met that kind before, their first of it.
 */
const favourite = (
    category: FavouriteCategory,
    value: string,
    title: string,
    first: boolean
): StandoutCopy => {
    const kind = filmOfKind(category, value);
    return {
        headline: first
            ? `Your first ${kind.replace(/^an? /, '')}`
            : `Your highest score ever for ${kind}`,
        unit: `your score for ${title}, out of ${MAX_SCORE}`,
        next: 'highest',
        chart: `Your top score for ${kind}, by year`,
        scale: SCORE,
    };
};

const isFavourite = (kind: MemberStandoutKind): kind is FavouriteKind =>
    kind.endsWith('-favourite');

interface MemberStandoutProps {
    year: number;
    inProgress: boolean;
    standout: Standout<MemberStandoutKind>;
    accent: string;
}

/** "2023 had only one pick, so it's left out." */
const thinNote = (years: number[]): string | undefined =>
    years.length
        ? `${listNames(years.map(String))} ${years.length === 1 ? 'had' : 'each had'} only one pick, so ${years.length === 1 ? 'it’s' : 'they’re'} left out.`
        : undefined;

/** The one way a member's year stood out from their own other years with the club. */
const MemberStandout: React.FC<MemberStandoutProps> = ({ year, inProgress, standout, accent }) => (
    <StandoutSlide
        eyebrow={`What set your ${year} apart`}
        year={year}
        inProgress={inProgress}
        standout={standout}
        copy={
            isFavourite(standout.kind)
                ? favourite(
                      standout.kind.replace('-favourite', '') as FavouriteCategory,
                      standout.subject ?? '',
                      standout.films[0]?.title ?? '',
                      standout.next === null
                  )
                : COPY[standout.kind]
        }
        accent={accent}
        footnote={thinNote(standout.thin ?? [])}
    />
);

export default MemberStandout;
