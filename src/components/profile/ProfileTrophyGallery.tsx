import { Link } from 'react-router-dom';
import { TrophyIcon } from '@heroicons/react/24/outline';
import { Film } from '../../types/film';
import { resolveTrophyIcon, TrophyWatermark } from '../common/trophyIcons';

interface TrophyAward {
    filmId: string;
    filmTitle: string;
    filmYear: string;
    poster: string;
    awardText: string;
}

interface GroupedTrophy {
    awardName: string;
    films: {
        filmId: string;
        filmTitle: string;
        filmYear: string;
        poster: string;
    }[];
}

interface ProfileTrophyGalleryProps {
    memberName: string;
    films: Film[];
}

const ProfileTrophyGallery = ({ memberName, films }: ProfileTrophyGalleryProps) => {
    // Extract all trophies for this member from all films
    const memberTrophies: TrophyAward[] = [];
    //const memberNameLower = memberName.toLowerCase();

    films.forEach(film => {
        const trophyNotes = film.movieClubInfo?.trophyNotes;
        if (!trophyNotes) return;

        // Split by comma to get individual trophy entries
        const trophyEntries = trophyNotes.split(',').map(t => t.trim()).filter(t => t !== '');

        trophyEntries.forEach(entry => {
            // Check if this member's name appears in this trophy entry (case-insensitive)
            const regex = new RegExp(`\\b${memberName}\\b`, 'gi');
            if (regex.test(entry)) {
                memberTrophies.push({
                    filmId: film.imdbID,
                    filmTitle: film.title,
                    filmYear: film.year,
                    poster: film.poster,
                    awardText: entry
                });
            }
        });
    });

    if (memberTrophies.length === 0) {
        return null;
    }

    // Group trophies by shared award text (normalizing the member name out)
    const groupedTrophies: GroupedTrophy[] = [];
    const trophyGroups = new Map<string, GroupedTrophy>();

    memberTrophies.forEach(trophy => {
        // Normalize the award text by removing the member name to get the "award type"
        // e.g., "Jacob gets a Togetherness Trophy" -> "gets a Togetherness Trophy"
        // e.g., "Togetherness Trophy: Jacob" -> "Togetherness Trophy:"
        const normalizedAward = trophy.awardText
            .replace(new RegExp(`\\b${memberName}\\b`, 'gi'), '')
            .replace(/\s+/g, ' ')
            .trim();

        // Clean up common patterns
        let awardKey = normalizedAward
            .replace(/^,\s*/, '')
            .replace(/,\s*$/, '')
            .replace(/^\s*:\s*/, '')
            .replace(/\s*:\s*$/, '')
            .replace(/^gets\s+(a\s+)?/i, '')
            .replace(/^-\s*/, '')
            .trim();

        // If after cleanup we have nothing meaningful, use the original text
        if (!awardKey || awardKey.length < 3) {
            awardKey = trophy.awardText;
        }

        // Capitalize first letter
        awardKey = awardKey.charAt(0).toUpperCase() + awardKey.slice(1);

        const existing = trophyGroups.get(awardKey);
        if (existing) {
            // Avoid duplicate films in the same group
            if (!existing.films.some(f => f.filmId === trophy.filmId)) {
                existing.films.push({
                    filmId: trophy.filmId,
                    filmTitle: trophy.filmTitle,
                    filmYear: trophy.filmYear,
                    poster: trophy.poster
                });
            }
        } else {
            trophyGroups.set(awardKey, {
                awardName: awardKey,
                films: [{
                    filmId: trophy.filmId,
                    filmTitle: trophy.filmTitle,
                    filmYear: trophy.filmYear,
                    poster: trophy.poster
                }]
            });
        }
    });

    // Convert map to array and sort by number of films (most first)
    trophyGroups.forEach(group => groupedTrophies.push(group));
    groupedTrophies.sort((a, b) => b.films.length - a.films.length);

    return (
        <div className="bg-slate-800 rounded-lg p-6 md:p-10 mb-8 border border-slate-700 shadow-xl shadow-slate-950/30">
            <div className="flex items-center gap-3 mb-6">
                <TrophyIcon className="h-5 w-5 text-amber-400/80" />
                <h4 className="text-xl font-bold text-slate-100">Trophy Shelf</h4>
                <span className="h-px flex-grow bg-gradient-to-r from-amber-400/25 via-slate-700/60 to-transparent" />
                <span className="text-sm text-slate-400 whitespace-nowrap">
                    {memberTrophies.length} award{memberTrophies.length !== 1 ? 's' : ''}
                </span>
            </div>

            <div className="space-y-2">
                {groupedTrophies.map((group, groupIndex) => {
                    const Icon = resolveTrophyIcon(group.awardName);
                    return (
                        <div
                            key={groupIndex}
                            className="group relative overflow-hidden flex items-start gap-3.5 rounded-xl border border-slate-700/40 bg-slate-800/30 px-4 py-3.5 transition-all duration-200 hover:border-amber-500/25 hover:bg-slate-800/60"
                        >
                            <TrophyWatermark className="-right-6 -bottom-10 h-40 w-40 transition-colors duration-200 group-hover:text-amber-400/[0.1]" />
                            <span className="relative flex-shrink-0 mt-0.5 text-amber-400/80 transition-transform duration-200 group-hover:scale-110 group-hover:text-amber-300">
                                <Icon className="h-6 w-6" />
                            </span>
                            <div className="relative flex-grow min-w-0">
                                <h5 className="text-slate-200 font-medium mb-2.5">
                                    {group.awardName}
                                    {group.films.length > 1 && (
                                        <span className="ml-2 text-xs text-amber-400/80 font-normal tabular-nums">
                                            ×{group.films.length}
                                        </span>
                                    )}
                                </h5>
                                <div className="flex flex-wrap gap-2">
                                    {group.films.map((film) => (
                                        <Link
                                            key={film.filmId}
                                            to={`/films/${film.filmId}`}
                                            className="group/film flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-md bg-slate-700/50 ring-1 ring-amber-400/15 hover:ring-amber-400/40 hover:bg-slate-700/80 transition-all duration-150"
                                            title={`${film.filmTitle} (${film.filmYear})`}
                                        >
                                            <img
                                                src={film.poster}
                                                alt={film.filmTitle}
                                                className="w-6 h-9 object-cover rounded shadow-sm ring-1 ring-amber-400/20"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = '/placeholder-poster.png';
                                                }}
                                            />
                                            <span className="text-sm text-slate-300 group-hover/film:text-slate-100 truncate max-w-[150px]">
                                                {film.filmTitle}
                                            </span>
                                            <span className="text-xs text-slate-500">
                                                ({film.filmYear})
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ProfileTrophyGallery;