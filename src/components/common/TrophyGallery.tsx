import { Link } from 'react-router-dom';
import { TrophyIcon } from '@heroicons/react/24/outline';
import type { ResolvedTrophy } from '../../utils/trophyUtils';
import CircularImage from './CircularImage';
import { resolveTrophyIcon, TrophyWatermark } from './trophyIcons';

/**
 * A film's trophy shelf.
 *
 * Renders whatever `resolveFilmTrophies` produced, which means the sheet's prose
 * and the site's structured awards land in the same rows and look alike. The
 * recipient is a chip linking to their profile — the one piece of an award that
 * was always the point, and that used to be recovered by running six regexes
 * over a sentence at render time.
 */

interface TrophyGalleryProps {
    trophies: ResolvedTrophy[];
    /** The editing surface, rendered under the shelf. Absent for a signed-out visitor. */
    children?: React.ReactNode;
}

const TrophyGallery = ({ trophies, children }: TrophyGalleryProps) => {
    if (trophies.length === 0 && !children) return null;

    return (
        <div className="mt-8 pt-6 border-t border-slate-700">
            <div className="flex items-center gap-3 mb-4">
                <TrophyIcon className="h-4 w-4 text-amber-400/80" />
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-[0.2em]">
                    Trophy Gallery
                </h3>
                <span className="h-px flex-grow bg-gradient-to-r from-amber-400/25 via-slate-700/60 to-transparent" />
            </div>

            <div className="space-y-1.5">
                {trophies.map((trophy) => {
                    const Icon = resolveTrophyIcon(trophy.award);
                    return (
                        <div
                            key={trophy.key}
                            className="group relative overflow-hidden flex items-start gap-3.5 rounded-xl border border-slate-700/40 bg-slate-800/30 px-4 py-3 transition-all duration-200 hover:border-amber-500/25 hover:bg-slate-800/60"
                        >
                            <TrophyWatermark className="-right-5 -bottom-7 h-32 w-32 transition-colors duration-200 group-hover:text-amber-400/[0.1]" />
                            <span className="relative flex-shrink-0 pt-0.5 text-amber-400/80 transition-transform duration-200 group-hover:scale-110 group-hover:text-amber-300">
                                <Icon className="h-6 w-6" />
                            </span>

                            <p className="relative leading-relaxed flex flex-wrap items-center gap-y-1.5">
                                {trophy.recipient && (
                                    <Link
                                        to={`/profile/${encodeURIComponent(trophy.recipient)}`}
                                        className="group/member inline-flex items-center gap-1.5 align-middle pl-0.5 pr-2 py-0.5 mr-2 rounded-md bg-slate-700/50 ring-1 ring-amber-400/15 hover:ring-amber-400/40 hover:bg-slate-700/80 transition-all duration-150"
                                        title={`View ${trophy.recipient}'s profile`}
                                    >
                                        <span className="ring-1 ring-amber-400/30 rounded-full">
                                            <CircularImage alt={trophy.recipient} size="w-5 h-5" />
                                        </span>
                                        <span className="text-amber-200/90 group-hover/member:text-amber-100 font-medium text-sm">
                                            {trophy.recipient}
                                        </span>
                                    </Link>
                                )}
                                <span className="text-slate-300">{trophy.award}</span>
                                {trophy.note && (
                                    <span className="ml-1.5 text-slate-400 italic">
                                        {trophy.note}
                                    </span>
                                )}
                            </p>
                        </div>
                    );
                })}
            </div>

            {children}
        </div>
    );
};

export default TrophyGallery;
