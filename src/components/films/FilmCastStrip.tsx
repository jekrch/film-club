import { CastMember } from '../../types/film';
import { PersonCredit } from '../../utils/filmUtils';
import PersonStrip, { PersonStripEntry } from './PersonStrip';

interface FilmCastStripProps {
    cast: CastMember[];
    // Maps a person's name to their full cross-film credits, used to decide
    // whether a cast name is clickable and to flag repeat club contributors.
    personAllFilmographies?: Record<string, PersonCredit[]>;
    onPersonClick?: (personName: string, filmography: PersonCredit[]) => void;
}

/**
 * Top-billed cast as a strip of headshot cards (character as the subtitle).
 * Sourced from TMDb via the sync script's `cast` field; rendering/clickability
 * are delegated to the shared {@link PersonStrip}.
 */
const FilmCastStrip = ({ cast, personAllFilmographies, onPersonClick }: FilmCastStripProps) => {
    if (!cast || cast.length === 0) return null;

    const people: PersonStripEntry[] = cast.map(member => ({
        name: member.name,
        profileUrl: member.profileUrl,
        subtitle: member.character,
        credits: personAllFilmographies?.[member.name] ?? [],
    }));

    return <PersonStrip title="Cast" people={people} onPersonClick={onPersonClick} />;
};

export default FilmCastStrip;
