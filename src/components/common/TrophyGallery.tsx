import { TrophyIcon } from '@heroicons/react/24/outline';
import type { ResolvedTrophy } from '../../utils/trophyUtils';
import TrophyRecipient from './TrophyRecipient';
import { resolveTrophyIcon, TrophyEmblem } from './trophyIcons';

/**
 * A film's trophy shelf.
 *
 * Renders whatever `resolveFilmTrophies` produced, so the sheet's prose and the
 * site's structured awards look alike. Each recipient links to their profile.
 */

interface TrophyGalleryProps {
    trophies: ResolvedTrophy[];
    /** The editing surface, rendered under the shelf. Absent for a signed-out visitor. */
    children?: React.ReactNode;
}

const TrophyGallery = ({ trophies, children }: TrophyGalleryProps) => {
    if (trophies.length === 0 && !children) return null;

    return (
        // `isolate` so the emblem's `-z-10` stays inside this section: it sits
        // behind the shelf without dropping behind the page card's background.
        <div className="relative isolate mt-8 pt-6 border-t border-slate-700">
            {/* A bare section rather than a card, so it carries its own clipping
            layer. Kept small: the section can be one trophy tall, and the mask
            has already faded the emblem out before its bottom edge. */}
            <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
                <TrophyEmblem className="-right-2 top-1 h-36 w-36" />
            </div>

            <div className="flex items-center gap-3 mb-4">
                <TrophyIcon className="h-4 w-4 text-amber-400/80" />
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-[0.2em]">
                    Trophy Gallery
                </h3>
                <span className="h-px flex-grow bg-gradient-to-r from-amber-400/25 via-slate-700/60 to-transparent" />
            </div>

            <div className="space-y-2">
                {trophies.map((trophy) => {
                    const Icon = resolveTrophyIcon(trophy.award);
                    return (
                        <div
                            key={trophy.key}
                            className="group/tile flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-slate-700/40 bg-slate-800/30 px-4 py-3 transition-colors duration-200 hover:border-amber-500/25 hover:bg-slate-800/60"
                        >
                            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-400/10 text-amber-400/80 ring-1 ring-amber-400/15 transition-colors duration-200 group-hover/tile:text-amber-300">
                                <Icon className="h-5 w-5" />
                            </span>
                            <div className="min-w-0 flex-grow">
                                <div className="font-medium leading-snug text-slate-200">
                                    {trophy.award}
                                </div>
                                {trophy.note && (
                                    <div className="mt-0.5 text-sm italic text-slate-400">
                                        {trophy.note}
                                    </div>
                                )}
                            </div>
                            {trophy.recipient && (
                                <div className="ml-auto">
                                    <TrophyRecipient recipient={trophy.recipient} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {children}
        </div>
    );
};

export default TrophyGallery;
