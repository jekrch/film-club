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
        <AccentCard decoration={<TrophyEmblem className="right-0 top-0 h-72 w-72" />}>
            <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h4 className="font-serif text-2xl italic text-slate-100">Trophy Cabinet</h4>
                <span className="h-px flex-grow self-center bg-slate-700/60" aria-hidden="true" />
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
                <div className="flex flex-wrap gap-x-8 gap-y-2.5">
                    {leaders.map((group) => (
                        <TrophyRecipient
                            key={group.recipient ?? '(unattributed)'}
                            recipient={group.recipient}
                        >
                            {/* Amber for the lead alone, ties included: the color
                            the ranked lists use for first place. */}
                            <span
                                className={`ml-0.5 font-serif text-xl not-italic leading-none tabular-nums ${
                                    group.trophies.length === leaders[0].trophies.length
                                        ? 'text-amber-300'
                                        : 'text-slate-200'
                                }`}
                            >
                                {group.trophies.length}
                            </span>
                        </TrophyRecipient>
                    ))}
                </div>
            </div>

            {/* A ledger rather than a grid of tiles: one award can hold most of the
            cabinet, and beside it a grid leaves a hole next to every short one. */}
            <div className="divide-y divide-slate-700/60">
                {groups.map((group) => {
                    const Icon = resolveTrophyIcon(group.award);
                    return (
                        <div
                            key={awardKey(group.award)}
                            className="grid grid-cols-1 gap-x-8 gap-y-3 py-4 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]"
                        >
                            {/* As tall as a poster from md, to center on the first holder */}
                            <div className="flex items-center gap-3 self-start md:min-h-12">
                                <span className="flex-shrink-0 text-amber-400/80">
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

                            {/* Indented to the title while stacked, so the icon stands
                            alone in its column. */}
                            <ul className="space-y-2.5 pl-8 md:pl-0">
                                {groupByRecipient(group.trophies).map((holder) => {
                                    // Room to name a lone film; a run of them is left
                                    // to the posters, whose count is the point.
                                    const isOnlyFilm = holder.trophies.length === 1;
                                    return (
                                        <li
                                            key={holder.recipient ?? '(unattributed)'}
                                            className="flex items-center gap-3"
                                        >
                                            {/* A fixed column, so posters start level and a
                                            longer run reads as a longer shelf. */}
                                            <div className="flex w-28 flex-shrink-0">
                                                <TrophyRecipient recipient={holder.recipient} />
                                            </div>
                                            <div className="flex min-w-0 flex-wrap gap-1.5">
                                                {holder.trophies.map((trophy) => (
                                                    <Link
                                                        key={trophy.key}
                                                        to={`/films/${trophy.film.imdbID}`}
                                                        className="group/film flex min-w-0 items-center gap-2.5 rounded"
                                                        title={filmTitle(trophy)}
                                                    >
                                                        <img
                                                            src={trophy.film.poster}
                                                            alt={
                                                                isOnlyFilm ? '' : trophy.film.title
                                                            }
                                                            loading="lazy"
                                                            className="h-12 w-8 flex-shrink-0 rounded object-cover shadow-sm shadow-black/40 ring-1 ring-slate-600/40 transition-shadow duration-150 group-hover/film:ring-amber-400/50"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).src =
                                                                    '/placeholder-poster.png';
                                                            }}
                                                        />
                                                        {isOnlyFilm && (
                                                            <span className="min-w-0">
                                                                <span className="block truncate text-sm text-slate-300 transition-colors duration-150 group-hover/film:text-amber-200">
                                                                    {trophy.film.title}{' '}
                                                                    <span className="text-xs tabular-nums text-slate-500">
                                                                        {trophy.film.year}
                                                                    </span>
                                                                </span>
                                                                {trophy.note && (
                                                                    <span className="mt-0.5 block truncate text-xs italic text-slate-400">
                                                                        {trophy.note}
                                                                    </span>
                                                                )}
                                                            </span>
                                                        )}
                                                    </Link>
                                                ))}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </AccentCard>
    );
};

export default TrophyCabinetCard;
