import { Link } from 'react-router-dom';
import { TrophyIcon } from '@heroicons/react/24/outline';
import { Film } from '../../types/film';
import { useTrophies } from '../../contexts/TrophiesContext';
import { getMemberTrophies, groupTrophies } from '../../utils/trophyUtils';
import { resolveTrophyIcon, TrophyWatermark } from '../common/trophyIcons';
import AccentCard from '../common/AccentCard';

/**
 * One member's trophy shelf, grouped by award.
 *
 * The grouping is the point: five Togetherness Trophies is one shelf entry with
 * five films on it, not five rows. What changed when awards became structured is
 * only *how a trophy is claimed for this member* — it used to be a regex for
 * their name across every film's `trophyNotes`, and is now `recipient`, with
 * `trophyUtils` doing the name-matching for the sheet's older prose. See
 * `getMemberTrophies`.
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
        <AccentCard accent="amber" className="p-6 md:p-10 mb-8">
            <div className="flex items-center gap-3 mb-6">
                <TrophyIcon className="h-5 w-5 text-amber-400/80" />
                <h4 className="text-xl font-bold text-slate-100">Trophy Shelf</h4>
                <span className="h-px flex-grow bg-gradient-to-r from-amber-400/25 via-slate-700/60 to-transparent" />
                <span className="text-sm text-slate-400 whitespace-nowrap">
                    {trophies.length} award{trophies.length !== 1 ? 's' : ''}
                </span>
            </div>

            <div className="space-y-2">
                {groups.map((group) => {
                    const Icon = resolveTrophyIcon(group.award);
                    return (
                        <div
                            key={group.award.toLowerCase()}
                            className="group relative overflow-hidden flex items-start gap-3.5 rounded-xl border border-slate-600/30 bg-slate-700/25 px-4 py-3.5 transition-all duration-200 hover:border-amber-500/25 hover:bg-slate-700/45"
                        >
                            <TrophyWatermark className="-right-6 -bottom-10 h-40 w-40 transition-colors duration-200 group-hover:text-amber-400/[0.1]" />
                            <span className="relative flex-shrink-0 mt-0.5 text-amber-400/80 transition-transform duration-200 group-hover:scale-110 group-hover:text-amber-300">
                                <Icon className="h-6 w-6" />
                            </span>
                            <div className="relative flex-grow min-w-0">
                                <h5 className="text-slate-200 font-medium mb-2.5">
                                    {group.award}
                                    {group.trophies.length > 1 && (
                                        <span className="ml-2 text-xs text-amber-400/80 font-normal tabular-nums">
                                            ×{group.trophies.length}
                                        </span>
                                    )}
                                </h5>
                                <div className="flex flex-wrap gap-2">
                                    {group.trophies.map((trophy) => (
                                        <Link
                                            key={trophy.key}
                                            to={`/films/${trophy.film.imdbID}`}
                                            className="group/film flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-md bg-slate-700/50 ring-1 ring-amber-400/15 hover:ring-amber-400/40 hover:bg-slate-700/80 transition-all duration-150"
                                            title={
                                                trophy.note
                                                    ? `${trophy.film.title} (${trophy.film.year}) — ${trophy.note}`
                                                    : `${trophy.film.title} (${trophy.film.year})`
                                            }
                                        >
                                            <img
                                                src={trophy.film.poster}
                                                alt={trophy.film.title}
                                                className="w-6 h-9 object-cover rounded shadow-sm ring-1 ring-amber-400/20"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src =
                                                        '/placeholder-poster.png';
                                                }}
                                            />
                                            <span className="text-sm text-slate-300 group-hover/film:text-slate-100 truncate max-w-[150px]">
                                                {trophy.film.title}
                                            </span>
                                            <span className="text-xs text-slate-500">
                                                ({trophy.film.year})
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </AccentCard>
    );
};

export default ProfileTrophyGallery;
