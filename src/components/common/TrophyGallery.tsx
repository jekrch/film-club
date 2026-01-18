import { Link } from 'react-router-dom';
import { TrophyIcon } from '@heroicons/react/24/solid';
import { teamMembers } from '../../types/team';
import CircularImage from './CircularImage';

interface TrophyGalleryProps {
    trophyNotes: string;
}

const capitalizeFirstLetter = (str: string): string => 
    str ? str.charAt(0).toUpperCase() + str.slice(1) : str;

const TrophyGallery = ({ trophyNotes }: TrophyGalleryProps) => {
    const renderTrophyItem = (trophyText: string, index: number) => {
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

        // Build the rendered content with member icons
        if (memberMatches.length === 0) {
            return (
                <div key={index} className="flex items-start gap-3 group">
                    <div className="flex-shrink-0 mt-0.5">
                        <div className="p-1.5 bg-amber-500/20 rounded-lg group-hover:bg-amber-500/30 transition-colors">
                            <TrophyIcon className="h-4 w-4 text-amber-400" />
                        </div>
                    </div>
                    <p className="text-slate-300 leading-relaxed pt-0.5">{trophyText.trim()}</p>
                </div>
            );
        }

        // Render text with inline member icons
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;

        memberMatches.forEach((match, matchIndex) => {
            // Add text before this match
            if (match.start > lastIndex) {
                parts.push(
                    <span key={`text-${matchIndex}`}>
                        {trophyText.slice(lastIndex, match.start)}
                    </span>
                );
            }

            // Add the member name with icon
            const displayName = capitalizeFirstLetter(match.name);
            parts.push(
                <Link
                    key={`member-${matchIndex}`}
                    to={`/profile/${encodeURIComponent(displayName)}`}
                    className="inline-flex items-center gap-1.5 mx-0.5 pl-0.5 pr-2 py-0.5 bg-slate-700/60 hover:bg-slate-600/80 rounded-full transition-all hover:scale-105 group/member"
                    title={`View ${displayName}'s profile`}
                >
                    <CircularImage 
                        alt={capitalizeFirstLetter(displayName)} 
                        size="w-5 h-5" 
                    />
                    <span className="text-blue-300 group-hover/member:text-blue-200 font-medium text-sm">
                        {trophyText.slice(match.start, match.end)}
                    </span>
                </Link>
            );

            lastIndex = match.end;
        });

        // Add remaining text
        if (lastIndex < trophyText.length) {
            parts.push(
                <span key="text-end">
                    {trophyText.slice(lastIndex).replace('gets a', '').replace('gets ', '')}
                </span>
            );
        }

        return (
            <div key={index} className="flex items-start gap-3 group">
                <div className="flex-shrink-0 mt-0.5">
                    <div className="p-1.5 bg-amber-500/20 rounded-lg group-hover:bg-amber-500/30 transition-colors">
                        <TrophyIcon className="h-4 w-4 text-amber-400" />
                    </div>
                </div>
                <p className="text-slate-300 leading-relaxed pt-0.5 flex flex-wrap items-center gap-y-1">
                    {parts}
                </p>
            </div>
        );
    };

    const trophies = trophyNotes.split(',').map(t => t.trim()).filter(t => t !== '');
    
    return (
        <div className="mt-8 pt-6 border-t border-slate-700">
            <div className="flex items-center gap-2.5 mb-4">
                <TrophyIcon className="h-5 w-5 text-amber-400" />
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                    Trophy Gallery
                </h3>
            </div>
            <div className="bg-slate-800/40 rounded-lg p-4 border border-slate-700/50">
                <div className="space-y-4">
                    {trophies.map((trophy, index) => renderTrophyItem(trophy, index))}
                </div>
            </div>
        </div>
    );
};

export default TrophyGallery;