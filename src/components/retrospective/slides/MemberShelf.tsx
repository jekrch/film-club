import React from 'react';
import { Link } from 'react-router-dom';
import type { MemberRetrospective } from '../../../utils/retrospectiveUtils';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { give } from '../../../hooks/useSqueeze';
import { Poster } from './shared';
import { Emblem, PalmFrond, WreathedCount } from './festivalArt';

interface MemberShelfProps {
    trophies: MemberRetrospective['trophies'];
    lists: MemberRetrospective['lists'];
    accent: string;
}

/** What they took home, and the lists they started. */
const MemberShelf: React.FC<MemberShelfProps> = ({ trophies, lists, accent }) => {
    // Only what they won: who gave a trophy isn't something the slide makes anything of.
    const won = trophies?.received.length ? trophies.received : null;
    return (
        <Slide>
            {won && (
                // The festival dressing of the club's trophy shelf: the palm,
                // gilded and faint, under everything (isolate keeps the -z
                // inside the slide), and the count in its wreath.
                <div className="relative isolate">
                    <PalmFrond className="absolute -top-10 -right-16 -z-10 h-72 w-72 opacity-[0.08] sm:-top-16 sm:-right-24 sm:h-[30rem] sm:w-[30rem]" />
                    <Reveal>
                        <Eyebrow color={accent}>Your shelf</Eyebrow>
                        <WreathedCount count={won.length} />
                    </Reveal>
                    {/* Each trophy on its own ruled line, two columns where there's room. */}
                    <div
                        className="grid sm:grid-cols-2 sm:gap-x-10"
                        style={{ marginTop: give('1.25rem', '0.5rem') }}
                    >
                        {won.slice(0, 6).map((trophy, i) => (
                            <Reveal
                                key={trophy.key}
                                step={1 + i * 0.25}
                                // Four fit a phone; the rest wait for a wider screen.
                                className={i >= 4 ? 'hidden sm:block' : undefined}
                            >
                                <div
                                    className="flex items-center gap-4 border-t border-slate-100/10"
                                    style={{
                                        paddingTop: give('0.875rem', '0.5rem'),
                                        paddingBottom: give('0.875rem', '0.5rem'),
                                    }}
                                >
                                    <Emblem award={trophy.award} />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-serif text-lg leading-snug text-slate-50">
                                            {trophy.award}
                                        </p>
                                        <p className="truncate text-sm text-slate-400">
                                            for <em>{trophy.film.title}</em>
                                            {trophy.note ? ` — ${trophy.note}` : ''}
                                        </p>
                                    </div>
                                    <Poster
                                        src={trophy.film.poster}
                                        title={trophy.film.title}
                                        className="w-9 sm:w-10"
                                    />
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            )}
            {lists && (
                <Reveal step={won ? 2.6 : 0}>
                    <div
                        // A rule that also closes the last trophy's line.
                        className={won ? 'border-t border-slate-100/10' : ''}
                        style={won ? { paddingTop: give('1.25rem', '0.75rem') } : undefined}
                    >
                        <Eyebrow color={accent}>Your lists</Eyebrow>
                        <ul className="mt-3 space-y-1">
                            {lists.map((list) => (
                                <li key={list.id}>
                                    <Link
                                        to={`/lists/${list.id}`}
                                        className="font-serif text-xl text-slate-100 underline-offset-4 hover:underline sm:text-2xl"
                                    >
                                        {list.name}
                                    </Link>{' '}
                                    <span className="text-sm text-slate-500">
                                        {list.entries.length} films
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </Reveal>
            )}
        </Slide>
    );
};

export default MemberShelf;
