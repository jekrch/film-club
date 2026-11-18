import React from 'react';
import { getTeamMemberByName } from '../../../types/team';
import { groupByRecipient, groupTrophies, type MemberTrophy } from '../../../utils/trophyUtils';
import type { ClubRetrospective } from '../../../utils/retrospectiveUtils';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { give } from '../../../hooks/useSqueeze';
import { FACE_RING, listNames, numberWord } from './format';
import { MemberFace } from './shared';
import { Emblem, PalmFrond, WreathedCount } from './festivalArt';

interface ClubTrophiesProps {
    trophies: NonNullable<ClubRetrospective['trophies']>;
    accent: string;
}

/** Who received an award, once each, with how many times. */
const recipientsOf = (trophies: MemberTrophy[]): { name: string | null; count: number }[] =>
    groupByRecipient(trophies).map((g) => ({ name: g.recipient, count: g.trophies.length }));

/** A member's face in the deck's usual ring, or a blank for an award the sheet named no one for. */
const Face: React.FC<{ name: string | null; size: string }> = ({ name, size }) =>
    name ? (
        <MemberFace
            name={name}
            color={getTeamMemberByName(name) ? FACE_RING : undefined}
            size={size}
        />
    ) : (
        <span
            className={`${size} flex shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs text-slate-400`}
            style={{ boxShadow: `0 0 0 2px ${FACE_RING}` }}
            title="Unattributed"
        >
            ?
        </span>
    );

/**
 * One person's tally, set the way the deck sets every tally: face, name in
 * small type, the figure in serif. `small` for the line under an award, where
 * a single award goes without its figure.
 */
const Tally: React.FC<{ name: string | null; count: number; small?: boolean }> = ({
    name,
    count,
    small = false,
}) => (
    <div className={`flex items-center ${small ? 'gap-1.5' : 'gap-2'}`}>
        <Face name={name} size={small ? 'h-5 w-5 sm:h-6 sm:w-6' : 'h-7 w-7 sm:h-8 sm:w-8'} />
        <div className="flex items-baseline gap-1.5">
            <dt className={`text-xs font-medium ${small ? 'text-slate-300' : 'text-slate-200'}`}>
                {name ?? 'Unattributed'}
            </dt>
            {(!small || count > 1) && (
                <dd
                    className={`font-serif leading-none text-slate-100 ${small ? 'text-base' : 'text-2xl'}`}
                >
                    {count}
                </dd>
            )}
        </div>
    </div>
);

/**
 * The year's trophy shelf: how many there were, wreathed like a festival's
 * official selection; who claimed the most accolades and everyone's haul; then
 * each award on a ruled line, with whose hands it went into.
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
            {/* The festival's palm, gilded and faint, leaning in over the shelf.
            Under everything (isolate keeps the -z inside the slide). */}
            <div className="relative isolate">
                <PalmFrond className="absolute -top-10 -right-16 -z-10 h-72 w-72 opacity-[0.08] sm:-top-16 sm:-right-24 sm:h-[30rem] sm:w-[30rem]" />

                <Reveal>
                    <Eyebrow color={accent}>The trophy shelf</Eyebrow>
                    <WreathedCount count={trophies.total} />
                </Reveal>

                {leaders.length > 0 && most > 1 && (
                    <Reveal step={1}>
                        <p
                            className="text-slate-400 sm:text-lg"
                            style={{ marginTop: give('1rem', '0.5rem') }}
                        >
                            <span className="text-slate-200">{listNames(leaders)}</span> claimed the
                            most accolades:{' '}
                            {leaders.length > 1 ? `${numberWord(most)} each` : numberWord(most)}.
                        </p>
                    </Reveal>
                )}

                {haul.length > 1 && (
                    <Reveal step={1.6}>
                        <dl
                            className="flex flex-wrap gap-x-6 gap-y-2"
                            style={{ marginTop: give('1rem', '0.5rem') }}
                        >
                            {haul.map(({ name, count }) => (
                                <Tally key={name} name={name} count={count} />
                            ))}
                        </dl>
                    </Reveal>
                )}

                {/* Each award on its own ruled line, two columns where there's room. */}
                <div
                    className="grid sm:grid-cols-2 sm:gap-x-10"
                    style={{ marginTop: give('1.75rem', '0.75rem') }}
                >
                    {shelf.map((group, i) => (
                        <Reveal
                            key={group.award}
                            step={2.4 + i * 0.25}
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
                                <Emblem award={group.award} />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-serif text-lg leading-snug text-slate-50">
                                        {group.award}
                                        {group.trophies.length > 1 && (
                                            <span className="ml-1 font-sans text-xs text-slate-500">
                                                {group.trophies.length}
                                            </span>
                                        )}
                                    </p>
                                    <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
                                        {recipientsOf(group.trophies).map(({ name, count }) => (
                                            <Tally
                                                key={name ?? 'unattributed'}
                                                name={name}
                                                count={count}
                                                small
                                            />
                                        ))}
                                    </dl>
                                </div>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </div>
        </Slide>
    );
};

export default ClubTrophies;
