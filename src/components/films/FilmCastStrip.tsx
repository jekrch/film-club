import { CastMember } from '../../types/film';

interface FilmCastStripProps {
    cast: CastMember[];
}

/**
 * Horizontally scrollable strip of top-billed cast members, each showing a
 * headshot (or initials fallback), name, and character. Sourced from TMDb via
 * the sync script's `cast` field.
 */
const FilmCastStrip = ({ cast }: FilmCastStripProps) => {
    if (!cast || cast.length === 0) return null;

    return (
        <div className="mt-6">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Cast</h2>
            <div className="flex gap-4 overflow-x-auto pb-3 -mx-1 px-1">
                {cast.map((member, index) => (
                    <div key={`${member.name}-${index}`} className="flex-shrink-0 w-24 text-center">
                        <div className="w-24 h-24 mx-auto mb-2 rounded-full overflow-hidden bg-slate-700 flex items-center justify-center">
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
                        </div>
                        <p className="text-xs font-medium text-slate-200 leading-tight truncate" title={member.name}>
                            {member.name}
                        </p>
                        {member.character && (
                            <p className="text-xs text-slate-500 leading-tight mt-0.5 line-clamp-2" title={member.character}>
                                {member.character}
                            </p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FilmCastStrip;
