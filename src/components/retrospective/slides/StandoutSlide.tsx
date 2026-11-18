import React from 'react';
import type { Standout } from '../../../utils/retrospectiveUtils';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { YearColumns } from './shared';
import { beat, listNames } from './format';
import type { StandoutCopy } from './standoutScales';

interface StandoutSlideProps {
    eyebrow: string;
    year: number;
    inProgress: boolean;
    standout: Standout<string>;
    copy: StandoutCopy;
    accent: string;
    /** A word on what the chart leaves out, starred on its label and set below it. */
    footnote?: string;
}

/**
 * The one way a year stood out from all the others: said in a line, its
 * figure set large, the closest any other year came, and every year's figure
 * in a row of columns with this one in the accent. The club's deck and each
 * member's tell it in their own words ({@link ClubStandout}, {@link MemberStandout}).
 */
const StandoutSlide: React.FC<StandoutSlideProps> = ({
    eyebrow,
    year,
    inProgress,
    standout,
    copy,
    accent,
    footnote,
}) => {
    const { format, scale } = copy.scale;
    const value = standout.years.find((y) => y.year === year)!.value;
    const { next } = standout;
    // A member's last resorts can match their best rather than beat it, or be
    // a first, with no other year to set beside it.
    const tied = next?.value === value;
    const figure = standout.share
        ? `${standout.share.count} of ${standout.share.of}`
        : format(value);

    return (
        <Slide>
            <Reveal>
                <Eyebrow color={accent}>{eyebrow}</Eyebrow>
                <h2 className="mt-3 font-serif text-3xl leading-tight text-balance text-slate-50 sm:text-5xl">
                    {copy.headline}
                    {inProgress ? ', so far' : ''}
                </h2>
            </Reveal>

            <Reveal step={1}>
                <p
                    className="mt-6 font-figures figures-trim text-[5.5rem] leading-none lining-nums tabular-nums sm:mt-8 sm:text-[8rem]"
                    style={{ color: accent }}
                >
                    {figure}
                </p>
                <p className="mt-2 text-lg text-slate-300 sm:text-xl">{copy.unit}</p>
            </Reveal>

            {next && (
                <Reveal step={2}>
                    <p className="mt-4 text-lg text-slate-400 sm:text-xl">
                        {tied
                            ? 'Matched in '
                            : `The next ${copy.next} was ${format(next.value)}, in `}
                        {listNames(next.years.map(String))}.
                    </p>
                </Reveal>
            )}

            {next && (
                <Reveal step={3}>
                    <div className="mt-8 sm:mt-10">
                        <YearColumns
                            label={footnote ? `${copy.chart}*` : copy.chart}
                            columns={standout.years}
                            year={year}
                            format={format}
                            scale={scale(standout.years.map((y) => y.value))}
                            accent={accent}
                            delay={beat(3) + 0.2}
                            tall
                        />
                        {footnote && (
                            <p className="mt-4 text-xs text-slate-500 sm:text-sm">* {footnote}</p>
                        )}
                    </div>
                </Reveal>
            )}
        </Slide>
    );
};

export default StandoutSlide;
