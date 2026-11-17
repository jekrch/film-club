import React from 'react';
import type { Film } from '../../../types/film';
import type { ClubRetrospective } from '../../../utils/retrospectiveUtils';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { MemberFace, Poster } from './shared';
import { FACE_RING, formatScore } from './format';

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
            <Eyebrow color={accent}>Our personal favs</Eyebrow>
        </Reveal>
        <div className="mt-6 grid grid-cols-2 items-start gap-x-4 gap-y-6 sm:mt-8 sm:gap-x-6 sm:gap-y-8">
            {favourites.map(({ member, loved, leastLoved }, i) => {
                // Members who loved the same film each get their own frame of
                // it: the first takes its first still, the next its second.
                const before = favourites
                    .slice(0, i)
                    .filter((f) => f.loved.film.imdbID === loved.film.imdbID).length;
                const stills = stillsOf(loved.film);
                const still = stills[before % Math.max(1, stills.length)];
                return (
                    <Reveal key={member.name} step={1 + i * 0.4}>
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-100 sm:text-base">
                            <MemberFace
                                name={member.name}
                                color={FACE_RING}
                                size="h-6 w-6 sm:h-7 sm:w-7"
                            />
                            {member.name}
                        </div>
                        {/* A frame of the film they loved, underlined. It is what gives when the slide is short of
                            room: cropped shorter, never scaled. */}
                        <div
                            className="retro-give-aspect relative mt-2 border-b-2 bg-slate-900 [--aspect:16/9] [--aspect-tight:16/5]"
                            style={{ borderColor: FACE_RING }}
                        >
                            {still && (
                                <img
                                    src={still}
                                    alt=""
                                    aria-hidden="true"
                                    className="h-full w-full object-cover"
                                />
                            )}
                        </div>
                        <div className="mt-3 flex items-start gap-3">
                            <Poster
                                src={loved.film.poster}
                                title={loved.film.title}
                                to={`/films/${loved.film.imdbID}`}
                                className="w-10 sm:w-12"
                            />
                            <div className="min-w-0">
                                <p className="line-clamp-2 font-serif text-base leading-snug text-slate-50 sm:text-lg">
                                    {loved.film.title}
                                </p>
                                <p
                                    className="mt-0.5 font-serif text-lg leading-none"
                                    style={{ color: accent }}
                                >
                                    {formatScore(loved.score)}
                                </p>
                            </div>
                        </div>
                        {leastLoved && (
                            <p className="mt-3 truncate text-xs text-slate-400 sm:text-sm">
                                Meh:{' '}
                                <span className="font-serif text-slate-300 italic">
                                    {leastLoved.film.title}
                                </span>{' '}
                                <span className="text-slate-500">
                                    · {formatScore(leastLoved.score)}
                                </span>
                            </p>
                        )}
                    </Reveal>
                );
            })}
        </div>
    </Slide>
);

export default ClubFavourites;
