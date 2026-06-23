import { CastMember } from '../../types/film';
import { PersonCredit } from '../../utils/filmUtils';

interface FilmCastStripProps {
    cast: CastMember[];
    // Maps a person's name to their full cross-film credits, used to decide
    // whether a cast name is clickable (appears in more than one film).
    personAllFilmographies?: Record<string, PersonCredit[]>;
    onPersonClick?: (personName: string, filmography: PersonCredit[]) => void;
}

/**
 * Horizontally scrollable strip of top-billed cast members, each showing a
 * headshot (or initials fallback), name, and character. Sourced from TMDb via
 * the sync script's `cast` field. Names that appear in more than one film
 * become clickable, opening the shared credits modal just like the "Stars".
 */
const FilmCastStrip = ({ cast, personAllFilmographies, onPersonClick }: FilmCastStripProps) => {
    if (!cast || cast.length === 0) return null;

    return (
        <div className="mt-6">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Cast</h2>
            <div className="flex gap-4 overflow-x-auto pb-3 -mx-1 px-1 themed-scrollbar">
                {cast.map((member, index) => {
                    const credits = personAllFilmographies?.[member.name] ?? [];
                    const isClickable = !!onPersonClick && credits.length > 1;

                    return (
                        <div key={`${member.name}-${index}`} className="flex-shrink-0 w-24 text-center">
                            <button
                                type="button"
                                onClick={isClickable ? () => onPersonClick!(member.name, credits) : undefined}
                                disabled={!isClickable}
                                className={`w-24 h-24 mx-auto mb-2 rounded-full overflow-hidden bg-slate-700 flex items-center justify-center ${isClickable ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400/50 hover:ring-2 hover:ring-blue-400/50 transition' : 'cursor-default'}`}
                                aria-label={isClickable ? `View ${member.name}'s credits` : undefined}
                            >
                                {member.profileUrl ? (
                                    <img
                                        src={member.profileUrl}
                                        alt={member.name}
                                        loading="lazy"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            // Hide a broken image so the slate fallback shows through.
                                            (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                    />
                                ) : (
                                    <span className="text-2xl font-semibold text-slate-400">
                                        {member.name.charAt(0)}
                                    </span>
                                )}
                            </button>
                            {isClickable ? (
                                <p className="text-xs font-medium leading-tight truncate" title={member.name}>
                                    <a
                                        onClick={() => onPersonClick!(member.name, credits)}
                                        className="text-blue-400 hover:text-blue-300 underline cursor-pointer transition-colors"
                                    >
                                        {member.name}
                                    </a>
                                </p>
                            ) : (
                                <p className="text-xs font-medium text-slate-200 leading-tight truncate" title={member.name}>
                                    {member.name}
                                </p>
                            )}
                            {member.character && (
                                <p className="text-xs text-slate-500 leading-tight mt-0.5 line-clamp-2" title={member.character}>
                                    {member.character}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default FilmCastStrip;
