import { Link } from 'react-router-dom';
import { TrophyIcon } from '@heroicons/react/24/outline';
import { Film } from '../../types/film';
import { useTrophies } from '../../contexts/TrophiesContext';
import { getMemberTrophies, groupTrophies } from '../../utils/trophyUtils';
import { resolveTrophyIcon, TrophyEmblem } from '../common/trophyIcons';
import AccentCard from '../common/AccentCard';

/**
 * One member's trophy shelf, grouped by award.
 *
 * Five Togetherness Trophies are one shelf entry with five films, not five rows.
 * Trophies are matched to this member by `recipient`, with `trophyUtils`
 * name-matching the sheet's prose. See `getMemberTrophies`.
 */

interface ProfileTrophyGalleryProps {
    memberName: string;
    films: Film[];
}

const ProfileTrophyGallery = ({ memberName, films }: ProfileTrophyGalleryProps) => {
    // Live while signed in, bundled otherwise — so a member who awarded a trophy
    // a minute ago sees it on the recipient's profile, not just the film page.
    const { films: liveTrophies } = useTrophies();

    const trophies = getMemberTrophies(films, memberName, liveTrophies);
    if (trophies.length === 0) return null;

    const groups = groupTrophies(trophies);

    return (
        <AccentCard
            accent="amber"
            className="p-6 md:p-10 mb-8"
            decoration={
                <TrophyEmblem className="-right-10 -top-10 h-72 w-72 group-hover/card:text-amber-400/[0.12]" />
            }
        >
            <div className="flex items-center gap-3 mb-6">
                <TrophyIcon className="h-5 w-5 text-amber-400/80" />
                <h4 className="text-xl font-bold text-slate-100">Trophy Shelf</h4>
                <span className="h-px flex-grow bg-gradient-to-r from-amber-400/25 via-slate-700/60 to-transparent" />
                <span className="text-sm text-slate-400 whitespace-nowrap">
                    {trophies.length} award{trophies.length !== 1 ? 's' : ''}
                </span>
            </div>

            <div className="space-y-3">
                {groups.map((group) => {
                    const Icon = resolveTrophyIcon(group.award);
                    return (
                        <div
                            key={group.award.toLowerCase()}
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
                            <div className="flex flex-wrap gap-x-5 gap-y-2 sm:pl-12">
                                {group.trophies.map((trophy) => (
                                    <Link
                                        key={trophy.key}
                                        to={`/films/${trophy.film.imdbID}`}
                                        className="group/film flex min-w-0 items-center gap-2.5"
                                        title={
                                            trophy.note
                                                ? `${trophy.film.title} (${trophy.film.year}) — ${trophy.note}`
                                                : `${trophy.film.title} (${trophy.film.year})`
                                        }
                                    >
                                        <img
                                            src={trophy.film.poster}
                                            alt=""
                                            loading="lazy"
                                            className="w-6 h-9 flex-shrink-0 object-cover rounded shadow-sm shadow-black/40 ring-1 ring-slate-600/40 transition-shadow duration-150 group-hover/film:ring-amber-400/50"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src =
                                                    '/placeholder-poster.png';
                                            }}
                                        />
                                        <span className="truncate max-w-[180px] text-sm text-slate-300 transition-colors duration-150 group-hover/film:text-amber-200">
                                            {trophy.film.title}
                                        </span>
                                        <span className="flex-shrink-0 text-xs tabular-nums text-slate-500">
                                            {trophy.film.year}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </AccentCard>
    );
};

export default ProfileTrophyGallery;
