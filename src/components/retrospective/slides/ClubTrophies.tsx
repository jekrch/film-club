import React from 'react';
import { resolveTrophyIcon } from '../../common/trophyIcons';
import CircularImage from '../../common/CircularImage';
import { getTeamMemberByName, teamMembers } from '../../../types/team';
import { groupByRecipient, groupTrophies, type MemberTrophy } from '../../../utils/trophyUtils';
import type { ClubRetrospective } from '../../../utils/retrospectiveUtils';
import CountUp from '../CountUp';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { give } from '../../../hooks/useSqueeze';
import { listNames, memberColor, numberWord } from './format';

interface ClubTrophiesProps {
    trophies: NonNullable<ClubRetrospective['trophies']>;
    accent: string;
}

/** A recipient's own colour, or a neutral one for an award the sheet attributed to nobody. */
const colorOf = (name: string | null): string => {
    const member = name ? getTeamMemberByName(name) : undefined;
    return member ? memberColor(member, teamMembers.indexOf(member)) : '#93a1b4';
};

/** A recipient's face in their colour, with how many they took if more than one. */
const Face: React.FC<{ name: string | null; count?: number; size: string }> = ({
    name,
    count,
    size,
}) => (
    <span className="relative inline-block" title={name ?? 'Unattributed'}>
        <span
            className="block rounded-full p-0.5"
            style={{ boxShadow: `0 0 0 2px ${colorOf(name)}` }}
        >
            {name ? (
                <CircularImage alt={name} size={size} className="!border-0" />
            ) : (
                <span
                    className={`${size} flex items-center justify-center rounded-full bg-slate-800 text-sm text-slate-400`}
                >
                    ?
                </span>
            )}
        </span>
        {count && count > 1 ? (
            <span className="absolute -right-1.5 -bottom-1 rounded-full bg-slate-950 px-1.5 text-[10px] font-semibold tabular-nums text-slate-100 ring-1 ring-slate-100/20">
                ×{count}
            </span>
        ) : null}
    </span>
);

/** Who received an award, once each, with how many times. */
const recipientsOf = (trophies: MemberTrophy[]): { name: string | null; count: number }[] =>
    groupByRecipient(trophies).map((g) => ({ name: g.recipient, count: g.trophies.length }));

/**
 * The year's trophy shelf: how many were handed out, who took home the most,
 * everyone's haul, and what each award was and whose hands it went into.
 */
const ClubTrophies: React.FC<ClubTrophiesProps> = ({ trophies, accent }) => {
    const shelf = groupTrophies(trophies.trophies).slice(0, 6);
    const haul = recipientsOf(trophies.trophies).filter(
        (r): r is { name: string; count: number } => r.name !== null
    );
    const most = haul[0]?.count ?? 0;
    const leaders = haul.filter((r) => r.count === most).map((r) => r.name);

    return (
        <Slide>
            <Reveal>
                <Eyebrow color={accent}>The trophy shelf</Eyebrow>
                <div className="mt-3 flex items-end gap-4">
                    <p className="font-serif text-[4.5rem] leading-none text-slate-50 sm:text-[7rem]">
                        <CountUp value={trophies.total} />
                    </p>
                    <p className="pb-2 font-serif text-xl text-slate-200 sm:text-3xl">
                        {trophies.total === 1 ? 'trophy' : 'trophies'} handed out
                    </p>
                </div>
            </Reveal>

            {leaders.length > 0 && most > 1 && (
                <Reveal step={1}>
                    <div
                        className="flex items-center gap-4"
                        style={{ marginTop: give('1.25rem', '0.75rem') }}
                    >
                        <div className="flex -space-x-3">
                            {leaders.map((name) => (
                                <Face key={name} name={name} size="h-14 w-14 sm:h-16 sm:w-16" />
                            ))}
                        </div>
                        <p className="text-lg text-slate-300 sm:text-xl">
                            <span className="font-serif text-slate-50">{listNames(leaders)}</span>{' '}
                            took home the most —{' '}
                            {leaders.length > 1 ? `${numberWord(most)} each` : numberWord(most)}
                        </p>
                    </div>
                </Reveal>
            )}

            {haul.length > 1 && (
                <Reveal step={1.8}>
                    <div
                        className="flex flex-wrap gap-x-5 gap-y-3"
                        style={{ marginTop: give('1.5rem', '0.75rem') }}
                    >
                        {haul.map(({ name, count }) => (
                            <div key={name} className="flex items-center gap-2">
                                <Face name={name} size="h-8 w-8" />
                                <span className="text-sm" style={{ color: colorOf(name) }}>
                                    {name}
                                </span>
                                <span className="font-serif text-lg text-slate-100">{count}</span>
                            </div>
                        ))}
                    </div>
                </Reveal>
            )}

            <div
                className="grid gap-x-6 sm:grid-cols-2"
                style={{ marginTop: give('1.75rem', '1rem'), rowGap: give('1rem', '0.5rem') }}
            >
                {shelf.map((group, i) => {
                    const Icon = resolveTrophyIcon(group.award);
                    return (
                        <Reveal
                            key={group.award}
                            step={2.6 + i * 0.3}
                            // Four fit a phone; the rest wait for a wider screen.
                            className={i >= 4 ? 'hidden sm:block' : undefined}
                        >
                            <div className="flex items-center gap-3">
                                <span style={{ color: accent }}>
                                    <Icon className="h-8 w-8 sm:h-10 sm:w-10" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-serif text-slate-100">
                                        {group.award}{' '}
                                        <span className="text-sm text-slate-500">
                                            ×{group.trophies.length}
                                        </span>
                                    </p>
                                    <div className="mt-1.5 flex flex-wrap gap-2.5">
                                        {recipientsOf(group.trophies).map(({ name, count }) => (
                                            <Face
                                                key={name ?? 'unattributed'}
                                                name={name}
                                                count={count}
                                                size="h-7 w-7"
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
};

export default ClubTrophies;
