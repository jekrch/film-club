import React from 'react';
import { getTeamMemberByName } from '../../../types/team';
import type { ClubRetrospective } from '../../../utils/retrospectiveUtils';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { give } from '../../../hooks/useSqueeze';
import { MemberFace, Poster } from './shared';
import { memberColor } from './format';

interface ClubSelectionsProps {
    selections: NonNullable<ClubRetrospective['selections']>;
    accent: string;
    /** Stills for the reel across the top. */
    reel?: string[];
}

/** Who brought what, a row of posters each. No scores: a pick isn't a contest. */
const ClubSelections: React.FC<ClubSelectionsProps> = ({ selections, accent, reel }) => (
    <Slide reel={reel}>
        <Reveal>
            <Eyebrow color={accent}>The year in picks</Eyebrow>
            <h2 className="mt-3 font-serif text-3xl text-slate-50 sm:text-5xl">
                Our official selections
            </h2>
        </Reveal>
        <div className="mt-6 flex flex-col sm:mt-8" style={{ gap: give('1.25rem', '0.625rem') }}>
            {selections.map(({ selector, films }, i) => {
                const member = getTeamMemberByName(selector);
                const color = member ? memberColor(member, i) : undefined;
                return (
                    <Reveal key={selector} step={1 + i * 0.5}>
                        <div className="flex items-center gap-4">
                            <span className="flex w-14 shrink-0 flex-col items-center gap-1 sm:w-20">
                                <MemberFace
                                    name={selector}
                                    color={color}
                                    size="h-9 w-9 sm:h-12 sm:w-12"
                                />
                                <span
                                    className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] sm:text-xs"
                                    style={{ color }}
                                >
                                    {selector}
                                </span>
                            </span>
                            <div className="flex min-w-0 gap-2 overflow-hidden">
                                {films.map((film) => (
                                    <Poster
                                        key={film.imdbID}
                                        src={film.poster}
                                        title={film.title}
                                        to={`/films/${film.imdbID}`}
                                        className="w-11 sm:w-16"
                                    />
                                ))}
                            </div>
                        </div>
                    </Reveal>
                );
            })}
        </div>
    </Slide>
);

export default ClubSelections;
