import { Link } from 'react-router-dom';
import { TrophyIcon } from '@heroicons/react/24/solid';
import { Film } from '../../types/film';

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
            <div className="flex items-center gap-2.5 mb-6 border-b border-slate-700 pb-3">
                {/* <TrophyIcon className="h-6 w-6 text-amber-400" /> */}
                <h4 className="text-xl font-bold text-slate-100">Trophy Shelf</h4>
                <span className="ml-auto text-sm text-slate-400">
                    {memberTrophies.length} award{memberTrophies.length !== 1 ? 's' : ''}
                </span>
            </div>
            
            <div className="space-y-6">
                {groupedTrophies.map((group, groupIndex) => (
                    <div key={groupIndex} className="group">
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                                <div className="p-2 bg-amber-500/20 rounded-lg group-hover:bg-amber-500/30 transition-colors">
                                    <TrophyIcon className="h-5 w-5 text-amber-400" />
                                </div>
                            </div>
                            <div className="flex-grow min-w-0">
                                <h5 className="text-slate-200 font-medium mb-2">
                                    {group.awardName}
                                    {group.films.length > 1 && (
                                        <span className="ml-2 text-xs text-amber-400/80 font-normal">
                                            ×{group.films.length}
                                        </span>
                                    )}
                                </h5>
                                <div className="flex flex-wrap gap-2">
                                    {group.films.map((film) => (
                                        <Link
                                            key={film.filmId}
                                            to={`/films/${film.filmId}`}
                                            className="group/film flex items-center gap-2 px-2 py-1.5 bg-slate-700/60 hover:bg-slate-600/80 rounded-lg transition-all hover:scale-[1.02]"
                                            title={`${film.filmTitle} (${film.filmYear})`}
                                        >
                                            <img
                                                src={film.poster}
                                                alt={film.filmTitle}
                                                className="w-6 h-9 object-cover rounded shadow-sm"
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
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ProfileTrophyGallery;