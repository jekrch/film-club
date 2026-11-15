import React from 'react';
import type { Film } from '../../../types/film';
import type { ClubRetrospective } from '../../../utils/retrospectiveUtils';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { MemberFace, Poster } from './shared';
import { formatScore, memberColor } from './format';

interface ClubFavouritesProps {
    favourites: NonNullable<ClubRetrospective['favourites']>;
    stillsOf: (film: Film) => string[];
    accent: string;
}

/**
 * What each member loved most this year, and least. Side by side, in roster
 * order, so it reads as four tastes rather than a league table — nothing here
 * says whose pick did well.
 */
const ClubFavourites: React.FC<ClubFavouritesProps> = ({ favourites, stillsOf, accent }) => (
    <Slide>
        <Reveal>
            <Eyebrow color={accent}>Our favourites</Eyebrow>
            <h2 className="mt-3 font-serif text-3xl text-slate-50 sm:text-5xl">
                What we each loved most
            </h2>
        </Reveal>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-4">
            {favourites.map(({ member, loved, leastLoved }, i) => {
                const still = stillsOf(loved.film)[0];
                return (
                    <Reveal
                        key={member.name}
                        step={1 + i * 0.5}
                        className="overflow-hidden rounded-md bg-slate-950/70 shadow-xl ring-1 ring-slate-100/10"
                    >
                        {/* A frame of the film they loved, as the card's header. It is
                            what gives when the slide is short of room: cropped
                            shorter, never scaled. */}
                        <div className="retro-give-aspect relative bg-slate-900 [--aspect:16/9] [--aspect-tight:16/5]">
                            {still && (
                                <img
                                    src={still}
                                    alt=""
                                    aria-hidden="true"
                                    className="h-full w-full object-cover"
                                />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent" />
                            <p
                                className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-slate-950/70 py-0.5 pr-2 pl-0.5 font-sans text-[10px] font-semibold uppercase tracking-[0.18em] sm:gap-2 sm:text-xs"
                                style={{ color: memberColor(member, i) }}
                            >
                                <MemberFace
                                    name={member.name}
                                    color={memberColor(member, i)}
                                    size="h-5 w-5 sm:h-7 sm:w-7"
                                />
                                {member.name}
                            </p>
                        </div>
                        <div className="flex items-start gap-2.5 px-2 pb-3 sm:px-3">
                            <Poster
                                src={loved.film.poster}
                                title={loved.film.title}
                                to={`/films/${loved.film.imdbID}`}
                                className="-mt-8 w-12 shadow-xl sm:-mt-10 sm:w-16"
                            />
                            <div className="min-w-0 pt-1.5">
                                <p className="font-serif text-sm leading-snug text-slate-100 sm:text-base">
                                    {loved.film.title}{' '}
                                    <span className="text-slate-400">
                                        {formatScore(loved.score)}
                                    </span>
                                </p>
                                {leastLoved && (
                                    <p className="mt-1.5 text-[11px] leading-snug text-slate-500 sm:text-xs">
                                        Least: {leastLoved.film.title} (
                                        {formatScore(leastLoved.score)})
                                    </p>
                                )}
                            </div>
                        </div>
                    </Reveal>
                );
            })}
        </div>
    </Slide>
);

export default ClubFavourites;
