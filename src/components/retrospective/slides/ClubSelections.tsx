import React from 'react';
import type { Film } from '../../../types/film';
import type { ClubRetrospective } from '../../../utils/retrospectiveUtils';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { give } from '../../../hooks/useSqueeze';
import { MemberFace, Poster } from './shared';
import { FACE_RING } from './format';

interface ClubSelectionsProps {
    selections: NonNullable<ClubRetrospective['selections']>;
    stillsOf: (film: Film) => string[];
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

/** A frame from one of their picks, to set their row against. */
const rowStill = (films: Film[], stillsOf: ClubSelectionsProps['stillsOf']): string | undefined => {
    for (const film of films) {
        const stills = stillsOf(film);
        if (stills.length) return stills[1] ?? stills[0];
    }
    return undefined;
};

/**
 * Who brought what: a band each, set against a frame from one of their own
 * picks, with their posters and the years their picks span.
 * No scores, and nothing set one member's picks against another's — a pick
 * isn't a contest.
 */
const ClubSelections: React.FC<ClubSelectionsProps> = ({ selections, stillsOf, accent, reel }) => (
    <Slide reel={reel}>
        <Reveal>
            <Eyebrow color={accent}>The picks</Eyebrow>
        </Reveal>
        <div className="mt-5 flex flex-col sm:mt-6" style={{ gap: give('0.75rem', '0.375rem') }}>
            {selections.map(({ selector, films }, i) => {
                const still = rowStill(films, stillsOf);
                const about = yearSpan(films);
                return (
                    <Reveal key={selector} step={1 + i * 0.4}>
                        <div
                            className="relative overflow-hidden border-l-[3px]"
                            style={{ borderColor: FACE_RING }}
                        >
                            {still && (
                                <img
                                    src={still}
                                    alt=""
                                    aria-hidden="true"
                                    className="absolute inset-0 h-full w-full object-cover opacity-60"
                                />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-r from-page via-page/80 to-page/20" />
                            <div className="relative flex items-center gap-3 py-2.5 pr-2 pl-3 sm:gap-5 sm:py-3 sm:pr-3 sm:pl-4">
                                <MemberFace
                                    name={selector}
                                    color={FACE_RING}
                                    size="h-9 w-9 sm:h-12 sm:w-12"
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="font-serif text-xl leading-tight text-slate-50 sm:text-2xl">
                                        {selector}
                                    </p>
                                    {about && (
                                        <p className="mt-0.5 truncate text-xs text-slate-300 sm:text-sm">
                                            {about}
                                        </p>
                                    )}
                                </div>
                                <div className="flex shrink-0 gap-1.5 sm:gap-2">
                                    {films.map((film) => (
                                        <Poster
                                            key={film.imdbID}
                                            src={film.poster}
                                            title={film.title}
                                            to={`/films/${film.imdbID}`}
                                            className="w-10 sm:w-14"
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </Reveal>
                );
            })}
        </div>
    </Slide>
);

export default ClubSelections;
