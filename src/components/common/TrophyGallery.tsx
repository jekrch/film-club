import { Link } from 'react-router-dom';
import { TrophyIcon } from '@heroicons/react/24/outline';
import { teamMembers } from '../../types/team';
import CircularImage from './CircularImage';
import { resolveTrophyIcon, TrophyWatermark } from './trophyIcons';

interface TrophyGalleryProps {
    trophyNotes: string;
}

const capitalizeFirstLetter = (str: string): string =>
    str ? str.charAt(0).toUpperCase() + str.slice(1) : str;

const TrophyGallery = ({ trophyNotes }: TrophyGalleryProps) => {
    const renderTrophyContent = (trophyText: string) => {
        // Find all member names in the trophy text (case-insensitive)
        const memberMatches: { name: string; start: number; end: number }[] = [];

        teamMembers.forEach(member => {
            const regex = new RegExp(`\\b${member.name}\\b`, 'gi');
            let match;
            while ((match = regex.exec(trophyText)) !== null) {
                memberMatches.push({
                    name: member.name!,
                    start: match.index,
                    end: match.index + member.name!.length
                });
            }
        });

        // Sort matches by position
        memberMatches.sort((a, b) => a.start - b.start);

        if (memberMatches.length === 0) {
            return <span className="text-slate-300">{trophyText.trim()}</span>;
        }

        // Render text with inline member chips
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;

        memberMatches.forEach((match, matchIndex) => {
            // Add text before this match
            if (match.start > lastIndex) {
                parts.push(
                    <span key={`text-${matchIndex}`} className="text-slate-400">
                        {trophyText.slice(lastIndex, match.start)}
                    </span>
                );
            }

            // Add the member name as an avatar chip
            const displayName = capitalizeFirstLetter(match.name);
            parts.push(
                <Link
                    key={`member-${matchIndex}`}
                    to={`/profile/${encodeURIComponent(displayName)}`}
                    className="group/member inline-flex items-center gap-1.5 align-middle pl-0.5 pr-2 py-0.5 mr-1 rounded-md bg-slate-700/50 ring-1 ring-amber-400/15 hover:ring-amber-400/40 hover:bg-slate-700/80 transition-all duration-150"
                    title={`View ${displayName}'s profile`}
                >
                    <span className="ring-1 ring-amber-400/30 rounded-full">
                        <CircularImage alt={displayName} size="w-5 h-5" />
                    </span>
                    <span className="text-amber-200/90 group-hover/member:text-amber-100 font-medium text-sm">
                        {trophyText.slice(match.start, match.end)}
                    </span>
                </Link>
            );

            lastIndex = match.end;
        });

        // Add remaining text (drop the connecting "gets"/"gets a" for a cleaner read)
        if (lastIndex < trophyText.length) {
            parts.push(
                <span key="text-end" className="text-slate-300">
                    {trophyText.slice(lastIndex).replace('gets a', '').replace('gets ', '')}
                </span>
            );
        }

        return parts;
    };

    const trophies = trophyNotes.split(',').map(t => t.trim()).filter(t => t !== '');

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
                {trophies.map((trophy, index) => {
                    const Icon = resolveTrophyIcon(trophy);
                    return (
                        <div
                            key={index}
                            className="group relative overflow-hidden flex items-start gap-3.5 rounded-xl border border-slate-700/40 bg-slate-800/30 px-4 py-3 transition-all duration-200 hover:border-amber-500/25 hover:bg-slate-800/60"
                        >
                            <TrophyWatermark className="-right-5 -bottom-7 h-32 w-32 transition-colors duration-200 group-hover:text-amber-400/[0.1]" />
                            <span className="relative flex-shrink-0 pt-0.5 text-amber-400/80 transition-transform duration-200 group-hover:scale-110 group-hover:text-amber-300">
                                <Icon className="h-6 w-6" />
                            </span>

                            <p className="relative leading-relaxed flex flex-wrap items-center gap-y-1.5">
                                {renderTrophyContent(trophy)}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TrophyGallery;
