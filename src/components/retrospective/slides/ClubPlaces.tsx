import React from 'react';
import { motion } from 'framer-motion';
import { prefersReducedMotion } from '../../../utils/motion';
import type { ClubRetrospective } from '../../../utils/retrospectiveUtils';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { Poster } from './shared';
import { numberWord } from './format';

interface ClubPlacesProps {
    year: number;
    places: NonNullable<ClubRetrospective['places']>;
    accent: string;
}

const capitalised = (text: string): string => text.replace(/^./, (c) => c.toUpperCase());

/** "Up from six countries in 2025", "Down from 14 countries in 2025", "The same as in 2025". */
const countryChange = (now: number, before: number, year: number): string => {
    const was = `${numberWord(before)} ${before === 1 ? 'country' : 'countries'}`;
    return now > before
        ? `Up from ${was} in ${year - 1}`
        : now < before
          ? `Down from ${was} in ${year - 1}`
          : `The same as in ${year - 1}`;
};

/** "1979 in 2025, five years older" — how this year's average sits against last year's. */
const yearChange = (now: number, before: number, year: number): string => {
    const gap = Math.abs(now - before);
    const span = `${numberWord(gap)} ${gap === 1 ? 'year' : 'years'}`;
    return now === before
        ? `The same as in ${year - 1}`
        : `${before} in ${year - 1}, ${span} ${now > before ? 'newer' : 'older'}`;
};

/** A film at one end of the year's span: its poster, which end, its title and year. */
const End: React.FC<{ label: string; film: ClubPlacesProps['places']['oldest'] }> = ({
    label,
    film,
}) => (
    <div className="flex min-w-0 items-center gap-3">
        <Poster src={film.poster} title={film.title} className="w-12" />
        <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">
                {label}
            </p>
            <p className="mt-1 font-serif text-base leading-snug text-slate-200 italic sm:text-lg">
                {film.title}
            </p>
            <p className="text-sm text-slate-400">{film.year.slice(0, 4)}</p>
        </div>
    </div>
);

/**
 * Where the year's films came from and when: the countries set as a line of
 * type, sized by how many films each gave us; the decades as a row of bars
 * beside the average release year; the oldest and newest at either end. Both
 * counts are set against the year before when there was one.
 */
const ClubPlaces: React.FC<ClubPlacesProps> = ({ year, places, accent }) => {
    const still = prefersReducedMotion();
    const { countries, decades, averageYear, oldest, newest, previousYear } = places;
    const most = Math.max(...countries.map((c) => c.y));
    const tallest = Math.max(...decades.map((d) => d.y));

    return (
        <Slide>
            <Reveal>
                <Eyebrow color={accent}>Where we went</Eyebrow>
                <h2 className="mt-3 font-serif text-3xl leading-tight text-slate-50 sm:text-5xl">
                    {capitalised(numberWord(countries.length))}{' '}
                    {countries.length === 1 ? 'country' : 'countries'}, {numberWord(decades.length)}{' '}
                    {decades.length === 1 ? 'decade' : 'decades'}
                </h2>
                {previousYear && (
                    <p className="mt-2 text-base text-slate-400 sm:text-lg">
                        {countryChange(countries.length, previousYear.countries, year)}.
                    </p>
                )}
            </Reveal>

            <Reveal step={1}>
                <ul className="mt-6 flex flex-wrap items-baseline gap-x-5 gap-y-2 font-serif leading-tight sm:mt-8">
                    {countries.map((country) => (
                        <li
                            key={country.name}
                            className="text-slate-100"
                            style={{ fontSize: `${0.9 + Math.sqrt(country.y / most) * 0.7}rem` }}
                        >
                            {country.name}
                            <span className="ml-1 align-baseline font-sans text-xs text-slate-500">
                                {country.y}
                            </span>
                        </li>
                    ))}
                </ul>
            </Reveal>

            <Reveal step={2}>
                <div className="mt-8 grid gap-6 border-t border-slate-100/10 pt-6 sm:mt-10 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-10">
                    <div className="flex h-24 items-end gap-2 sm:gap-3">
                        {decades.map((decade, i) => (
                            <div
                                key={decade.name}
                                className="flex flex-1 flex-col items-center gap-1"
                            >
                                <motion.div
                                    className="w-full max-w-10 origin-bottom rounded-t-sm"
                                    style={{
                                        height: `${(decade.y / tallest) * 72}px`,
                                        backgroundColor: accent,
                                        opacity: 0.4 + (decade.y / tallest) * 0.6,
                                    }}
                                    initial={still ? false : { scaleY: 0 }}
                                    animate={{ scaleY: 1 }}
                                    transition={{ delay: 1.1 + i * 0.08, duration: 0.6 }}
                                />
                                <span className="text-[10px] text-slate-400 sm:text-xs">
                                    {decade.name.replace(/^\d\d/, "'")}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="sm:text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">
                            Average year
                        </p>
                        <p className="font-serif text-4xl leading-none text-slate-50 sm:text-5xl">
                            {averageYear}
                        </p>
                        {previousYear?.averageYear != null && (
                            <p className="mt-1 text-sm text-slate-400">
                                {yearChange(averageYear, previousYear.averageYear, year)}
                            </p>
                        )}
                    </div>
                </div>
            </Reveal>

            {oldest.imdbID !== newest.imdbID && (
                <Reveal step={3}>
                    <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-8">
                        <End label="Oldest" film={oldest} />
                        <End label="Newest" film={newest} />
                    </div>
                </Reveal>
            )}
        </Slide>
    );
};

export default ClubPlaces;
