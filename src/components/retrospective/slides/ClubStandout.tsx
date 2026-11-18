import React from 'react';
import { MAX_SCORE } from '../../../utils/ratingEditUtils';
import type { Standout, StandoutKind } from '../../../utils/retrospectiveUtils';
import StandoutSlide from './StandoutSlide';
import {
    COUNT,
    MONTHS_OF_YEAR,
    RELEASE,
    SCORE,
    SHARE,
    SPREAD,
    type StandoutCopy,
} from './standoutScales';

const COPY: Record<StandoutKind, StandoutCopy> = {
    'highest-score': {
        headline: 'Our highest-scoring year',
        unit: `our average score, out of ${MAX_SCORE}`,
        next: 'highest',
        chart: 'Average score by year',
        scale: SCORE,
    },
    'lowest-score': {
        headline: 'Our lowest-scoring year',
        unit: `our average score, out of ${MAX_SCORE}`,
        next: 'lowest',
        chart: 'Average score by year',
        scale: SCORE,
    },
    'most-films': {
        headline: 'Our most films in a year',
        unit: 'films together',
        next: 'most',
        chart: 'Films by year',
        scale: COUNT,
    },
    'most-hours': {
        headline: 'Our most hours together',
        unit: 'hours of film',
        next: 'most',
        chart: 'Hours by year',
        scale: COUNT,
    },
    'most-countries': {
        headline: 'Our most widely travelled year',
        unit: 'countries',
        next: 'most',
        chart: 'Countries by year',
        scale: COUNT,
    },
    'most-languages': {
        headline: 'Our most languages in a year',
        unit: 'languages',
        next: 'most',
        chart: 'Languages by year',
        scale: COUNT,
    },
    'least-english': {
        headline: 'Our least English-speaking year',
        unit: 'films not in English',
        next: 'highest share',
        chart: 'Films not in English, by year',
        scale: SHARE,
    },
    'least-american': {
        headline: 'Our least American year',
        unit: 'films made outside the United States',
        next: 'highest share',
        chart: 'Films made outside the US, by year',
        scale: SHARE,
    },
    oldest: {
        headline: 'Our deepest dig into the past',
        unit: 'the average year our films came out',
        next: 'oldest',
        chart: 'Average release year',
        scale: RELEASE,
    },
    newest: {
        headline: 'Our most modern year',
        unit: 'the average year our films came out',
        next: 'newest',
        chart: 'Average release year',
        scale: RELEASE,
    },
    agreed: {
        headline: 'The year we agreed most',
        unit: 'points between our highest and lowest score on a film, on average',
        next: 'closest',
        chart: 'Spread of our scores by year',
        scale: SPREAD,
    },
    divided: {
        headline: 'The year we agreed least',
        unit: 'points between our highest and lowest score on a film, on average',
        next: 'widest',
        chart: 'Spread of our scores by year',
        scale: SPREAD,
    },
    longest: {
        headline: 'Our longest films',
        unit: 'minutes a film, on average',
        next: 'longest',
        chart: 'Average runtime by year',
        scale: COUNT,
    },
    'most-months': {
        headline: 'Our steadiest year',
        unit: 'months with a screening',
        next: 'most',
        chart: 'Months with a screening, by year',
        scale: MONTHS_OF_YEAR,
    },
};

interface ClubStandoutProps {
    year: number;
    inProgress: boolean;
    standout: Standout;
    accent: string;
}

/** The one way the club's year stood out from all its others. */
const ClubStandout: React.FC<ClubStandoutProps> = ({ year, inProgress, standout, accent }) => (
    <StandoutSlide
        eyebrow={`What set ${year} apart`}
        year={year}
        inProgress={inProgress}
        standout={standout}
        copy={COPY[standout.kind]}
        accent={accent}
    />
);

export default ClubStandout;
