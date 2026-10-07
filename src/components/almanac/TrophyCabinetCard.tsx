import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Film } from '../../types/film';
import { useTrophies } from '../../contexts/TrophiesContext';
import {
    awardKey,
    getClubTrophies,
    groupByRecipient,
    groupTrophies,
    type MemberTrophy,
} from '../../utils/trophyUtils';
import { resolveTrophyIcon, TrophyEmblem } from '../common/trophyIcons';
import AccentCard from '../common/AccentCard';
import TrophyRecipient from '../common/TrophyRecipient';

/**
 * The club's whole trophy cabinet: every award, grouped by what it is called,
 * with who won it and for which films.
 *
 * Reads the same two sources as the profile shelf (the sheet's `trophyNotes`
 * and `trophies.json`) through `trophyUtils`, so the cabinet and a member's
 * shelf can never disagree on a count.
 */

interface TrophyCabinetCardProps {
    films: Film[];
}

const filmTitle = (trophy: MemberTrophy): string => {
    const base = `${trophy.film.title} (${trophy.film.year})`;
    return trophy.note ? `${base} — ${trophy.note}` : base;
};

const TrophyCabinetCard: React.FC<TrophyCabinetCardProps> = ({ films }) => {
    // Live while signed in, bundled otherwise — the same arrangement as the
    // profile shelf, so an award given a minute ago shows up here too.
    const { films: liveTrophies } = useTrophies();

    const { trophies, groups, leaders } = useMemo(() => {
        const trophies = getClubTrophies(films, liveTrophies);
        return {
            trophies,
            groups: groupTrophies(trophies),
            leaders: groupByRecipient(trophies),
        };
    }, [films, liveTrophies]);

    if (trophies.length === 0) return null;

    return (
        <AccentCard
            accent="amber"
            className="p-6"
            decoration={
                <TrophyEmblem className="-right-10 -top-10 h-72 w-72 group-hover/card:text-amber-400/[0.12]" />
            }
        >
            <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h4 className="font-serif text-2xl italic text-slate-100">Trophy Cabinet</h4>
                <span
                    className="h-px flex-grow self-center bg-gradient-to-r from-amber-400/25 via-slate-700/60 to-transparent"
                    aria-hidden="true"
                />
                <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                    <span className="mr-1 font-serif text-sm normal-case tracking-normal tabular-nums text-slate-300">
                        {trophies.length}
                    </span>
                    award{trophies.length !== 1 ? 's' : ''}
                </span>
            </div>
            <p className="text-xs text-slate-400 mb-5 italic">
                Every honor the club has bestowed. Bless us all.
            </p>

            {/* The tally: who holds the most, across every award. */}
            <div className="mb-6 border-b border-slate-700/50 pb-5">
                <div className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                    Most decorated
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2.5">
                    {leaders.map((group) => (
                        <TrophyRecipient
                            key={group.recipient ?? '(unattributed)'}
                            recipient={group.recipient}
                        >
                            <span className="font-serif tabular-nums text-amber-300/80">
                                {group.trophies.length}
                            </span>
                        </TrophyRecipient>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {groups.map((group) => {
                    const Icon = resolveTrophyIcon(group.award);
                    return (
                        <div
                            key={awardKey(group.award)}
                            className="group/tile rounded-xl border border-slate-600/30 bg-slate-700/25 p-4 transition-colors duration-200 hover:border-amber-500/25 hover:bg-slate-700/40"
                        >
                            <div className="mb-3 flex items-center gap-3">
                                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-400/10 text-amber-400/80 ring-1 ring-amber-400/15 transition-colors duration-200 group-hover/tile:text-amber-300">
                                    <Icon className="h-5 w-5" />
                                </span>
                                <h5 className="min-w-0 flex-grow font-medium leading-snug text-slate-200">
                                    {group.award}
                                </h5>
                                {group.trophies.length > 1 && (
                                    <span className="flex-shrink-0 font-serif text-sm tabular-nums text-amber-300/70">
                                        ×{group.trophies.length}
                                    </span>
                                )}
                            </div>

                            {/* Indented to the title on wider screens, so the
                            icon stands alone in its column. */}
                            <ul className="space-y-2 sm:pl-12">
                                {groupByRecipient(group.trophies).map((holder) => (
                                    <li
                                        key={holder.recipient ?? '(unattributed)'}
                                        className="flex items-center gap-3"
                                    >
                                        <TrophyRecipient recipient={holder.recipient} />
                                        <div className="ml-auto flex flex-wrap justify-end gap-1">
                                            {holder.trophies.map((trophy) => (
                                                <Link
                                                    key={trophy.key}
                                                    to={`/films/${trophy.film.imdbID}`}
                                                    className="flex-shrink-0 rounded transition-transform duration-150 hover:scale-110"
                                                    title={filmTitle(trophy)}
                                                >
                                                    <img
                                                        src={trophy.film.poster}
                                                        alt={trophy.film.title}
                                                        loading="lazy"
                                                        className="w-6 h-9 object-cover rounded shadow-sm shadow-black/40 ring-1 ring-slate-600/40 hover:ring-amber-400/50"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src =
                                                                '/placeholder-poster.png';
                                                        }}
                                                    />
                                                </Link>
                                            ))}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </AccentCard>
    );
};

export default TrophyCabinetCard;
