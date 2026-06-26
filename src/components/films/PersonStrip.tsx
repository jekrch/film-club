import { PersonCredit } from '../../utils/filmUtils';
import { isPersonClickable, personLinkClasses } from '../../utils/personUtils';

export interface PersonStripEntry {
    name: string;
    profileUrl?: string | null; // TMDb headshot, if available
    subtitle?: string | null;   // character (cast) or role(s) (crew)
    // Cross-film credits for this person, used to decide clickability and to
    // distinguish repeat club contributors. Empty/length<=1 => one-off.
    credits: PersonCredit[];
}

interface PersonStripProps {
    title: string;
    people: PersonStripEntry[];
    onPersonClick?: (personName: string, filmography: PersonCredit[]) => void;
}

/**
 * Horizontally scrollable strip of people as headshot cards (photo or initials
 * fallback), each with a name and a subtitle (character for cast, role for crew).
 * Names we can resolve to a TMDb person (or who appear in more than one club
 * film) are clickable and open the person modal. Repeat club contributors get a
 * distinct amber treatment. Shared by the cast and crew strips.
 */
const PersonStrip = ({ title, people, onPersonClick }: PersonStripProps) => {
    if (!people || people.length === 0) return null;

    return (
        <div className="mt-6">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{title}</h2>
            {/* Negative margins + matching padding give the focus/amber rings room
                to render without being clipped by the scroll container (overflow-x
                also clips the vertical axis). */}
            <div className="flex gap-4 overflow-x-auto pb-3 pt-1 -mx-1 -mt-1 px-1 themed-scrollbar">
                {people.map((person, index) => {
                    const credits = person.credits;
                    const isClickable = !!onPersonClick && isPersonClickable(person.name, credits.length);
                    const isRepeat = credits.length > 1;

                    return (
                        <div key={`${person.name}-${index}`} className="flex-shrink-0 w-24 text-center">
                            <button
                                type="button"
                                onClick={isClickable ? () => onPersonClick!(person.name, credits) : undefined}
                                disabled={!isClickable}
                                className={`w-24 h-24 mx-auto mb-2 rounded-full overflow-hidden bg-slate-700 flex items-center justify-center ${isClickable ? `cursor-pointer focus:outline-none transition ${isRepeat ? 'ring-2 ring-amber-400/60 focus:ring-2 focus:ring-amber-300 hover:ring-amber-300' : 'focus:ring-2 focus:ring-blue-400/50 hover:ring-2 hover:ring-blue-400/50'}` : 'cursor-default'}`}
                                aria-label={isClickable ? `View ${person.name}'s credits` : undefined}
                            >
                                {person.profileUrl ? (
                                    <img
                                        src={person.profileUrl}
                                        alt={person.name}
                                        loading="lazy"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            // Hide a broken image so the slate fallback shows through.
                                            (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                    />
                                ) : (
                                    <span className="text-2xl font-semibold text-slate-400">
                                        {person.name.charAt(0)}
                                    </span>
                                )}
                            </button>
                            {isClickable ? (
                                <p className="text-xs font-medium leading-tight truncate" title={isRepeat ? `In ${credits.length} club films` : person.name}>
                                    <a
                                        onClick={() => onPersonClick!(person.name, credits)}
                                        className={`${personLinkClasses(isRepeat)} cursor-pointer transition-colors`}
                                    >
                                        {person.name}
                                    </a>
                                </p>
                            ) : (
                                <p className="text-xs font-medium text-slate-200 leading-tight truncate" title={person.name}>
                                    {person.name}
                                </p>
                            )}
                            {person.subtitle && (
                                <p className="text-xs text-slate-500 leading-tight mt-0.5 line-clamp-2" title={person.subtitle}>
                                    {person.subtitle}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default PersonStrip;
