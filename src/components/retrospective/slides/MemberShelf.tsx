import React from 'react';
import { Link } from 'react-router-dom';
import type { MemberRetrospective } from '../../../utils/retrospectiveUtils';
import { resolveTrophyIcon } from '../../common/trophyIcons';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { give } from '../../../hooks/useSqueeze';
import { Poster } from './shared';

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
                <>
                    <Reveal>
                        <Eyebrow color={accent}>Your trophies</Eyebrow>
                    </Reveal>
                    <div
                        className="mt-5 flex flex-col"
                        style={{ gap: give('0.75rem', '0.375rem') }}
                    >
                        {won.slice(0, 4).map((trophy, i) => {
                            const Icon = resolveTrophyIcon(trophy.award);
                            return (
                                <Reveal key={trophy.key} step={1 + i * 0.4}>
                                    <div className="flex items-center gap-4">
                                        <span style={{ color: accent }}>
                                            <Icon className="h-9 w-9 sm:h-11 sm:w-11" />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-serif text-xl text-slate-50 sm:text-2xl">
                                                {trophy.award}
                                            </p>
                                            <p className="text-sm text-slate-400">
                                                for <em>{trophy.film.title}</em>
                                                {trophy.note ? ` — ${trophy.note}` : ''}
                                            </p>
                                        </div>
                                        <Poster
                                            src={trophy.film.poster}
                                            title={trophy.film.title}
                                            className="w-9 sm:w-11"
                                        />
                                    </div>
                                </Reveal>
                            );
                        })}
                    </div>
                </>
            )}
            {lists && (
                <Reveal step={3.4}>
                    <div
                        className={won ? 'border-t border-slate-100/10' : ''}
                        style={
                            won
                                ? {
                                      marginTop: give('2rem', '1rem'),
                                      paddingTop: give('1.25rem', '0.75rem'),
                                  }
                                : undefined
                        }
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
