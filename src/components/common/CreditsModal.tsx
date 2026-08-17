import React, { useMemo, useRef } from 'react';
import { Film } from '../../types/film';
import { Link } from 'react-router-dom';
import {
    getPersonInfoByName,
    getPersonProfileByName,
    tmdbPersonUrl,
} from '../../utils/personUtils';
import { useFilmFrames } from '../../hooks/useFilmFrames';
import { FilmFrameImage } from './filmFrames';
import Modal from './Modal';

/**
 * The still runs strongest behind the header and is gone by the time the bio
 * starts, so the heading sits *on* the artwork rather than under a flat panel —
 * the treatment the hero banners use, at the scale of a dialog.
 */
const FRAME_FADE =
    'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 30%, rgba(0,0,0,0) 72%)';

// Formats a TMDb date string (YYYY-MM-DD) for display, e.g. "May 14, 1944".
const formatPersonDate = (value: string | null | undefined): string | null => {
    if (!value) return null;
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

interface CreditsModalProps {
    isOpen: boolean;
    onClose: () => void;
    personName: string | null;
    filmography: Array<{ film: Film; roles: string[] }> | null;
    currentFilmId?: string; // To highlight the current film in the list
}

// Finds the character a person played in a given film, using the TMDb `cast`
// list. Returns null when the person isn't in the cast or has no named role.
const getCharacterForPerson = (film: Film, personNameLower: string): string | null => {
    const match = film.cast?.find(
        (member) => member?.name?.trim().toLowerCase() === personNameLower
    );
    const character = match?.character?.trim();
    return character ? character : null;
};

const CreditsModal: React.FC<CreditsModalProps> = ({
    isOpen,
    onClose,
    personName,
    filmography,
    currentFilmId,
}) => {
    // Callers clear their person/filmography state as soon as `onClose` fires, so
    // hold on to the last credit we were given and keep rendering it while the
    // modal animates out — otherwise the panel would empty mid-fade.
    const contentRef = useRef<{
        personName: string;
        filmography: Array<{ film: Film; roles: string[] }>;
    } | null>(null);
    if (personName && filmography) {
        contentRef.current = { personName, filmography };
    }
    const content = contentRef.current;
    const activePersonName = content?.personName ?? null;
    const activeFilmography = content?.filmography ?? null;
    const personNameLower = (activePersonName ?? '').trim().toLowerCase();

    // Normalized TMDb record (bio, birth/death, known-for, canonical headshot)
    // resolved from the person's name, if we have one for them.
    const personInfo = useMemo(() => getPersonInfoByName(activePersonName), [activePersonName]);
    const tmdbId = useMemo(
        () => getPersonProfileByName(activePersonName)?.tmdbId,
        [activePersonName]
    );

    // Prefer a per-film cast headshot (closest to the credit shown); fall back to
    // the canonical TMDb portrait so crew members with no cast entry still get a photo.
    const profileUrl = useMemo(() => {
        if (activeFilmography) {
            for (const { film } of activeFilmography) {
                const match = film.cast?.find(
                    (member) => member?.name?.trim().toLowerCase() === personNameLower
                );
                if (match?.profileUrl) return match.profileUrl;
            }
        }
        return personInfo?.profileUrl ?? null;
    }, [activeFilmography, personNameLower, personInfo]);

    // A still from one of their films for the background wash — the headshot is
    // already shown sharp in the bio, so repeating it there added nothing.
    const creditFilms = useMemo(
        () => (activeFilmography ?? []).map(({ film }) => film),
        [activeFilmography]
    );
    const [backdropFrame] = useFilmFrames(creditFilms, 1);

    if (!activePersonName || !activeFilmography) return null;

    const bornDate = formatPersonDate(personInfo?.birthday);
    const diedDate = formatPersonDate(personInfo?.deathday);
    const birthLine = [bornDate, personInfo?.placeOfBirth].filter(Boolean).join(' · ');
    const hasPersonDetails = !!(
        personInfo?.biography ||
        birthLine ||
        diedDate ||
        personInfo?.knownForDepartment ||
        tmdbId
    );

    // Sort filmography: by year descending, then by title ascending
    const sortedFilmography = [...activeFilmography].sort((a, b) => {
        const yearComparison = (b.film.year || '0').localeCompare(a.film.year || '0');
        if (yearComparison !== 0) return yearComparison;
        return (a.film.title || '').localeCompare(b.film.title || '');
    });

    // A still from one of their films washed behind the header — or their
    // headshot down the right edge when none of the credits have imagery, since
    // a portrait can't span the panel the way a landscape still can.
    const decoration = (backdropFrame || profileUrl) && (
        <>
            {backdropFrame ? (
                <div
                    className="absolute inset-0 overflow-hidden opacity-[0.34]"
                    style={{ WebkitMaskImage: FRAME_FADE, maskImage: FRAME_FADE }}
                >
                    <FilmFrameImage frame={backdropFrame} />
                </div>
            ) : (
                <img
                    src={profileUrl!}
                    alt=""
                    aria-hidden="true"
                    className="absolute right-0 top-0 h-full w-2/3 object-cover object-top opacity-10"
                    onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                    }}
                />
            )}
            {/* Holds the left column dark enough for the heading to read against
                whatever the frame happens to be doing up there. */}
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900 from-25% via-slate-900/70 to-slate-900/25" />
        </>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            eyebrow="Credits"
            title={activePersonName}
            subtitle={personInfo?.knownForDepartment}
            accent="blue"
            decoration={decoration}
            className="max-w-xl md:max-w-2xl max-h-[88vh]"
        >
            <>
                {/* Person details: bio, birth/death, and a link to the full TMDb profile. */}
                {(hasPersonDetails || profileUrl) && (
                    <div className="relative z-10 px-4 md:px-5 py-3 border-b border-slate-700/60 flex flex-col min-h-0 space-y-2">
                        {/* Scrolling text column; the headshot floats so the text wraps around it */}
                        <div className="min-h-0 overflow-y-auto themed-scrollbar pr-2">
                            {profileUrl && (
                                <img
                                    src={profileUrl}
                                    alt={activePersonName}
                                    className="float-left w-1/2 max-w-[12em] mr-3 mb-2 rounded shadow-sm border border-slate-600/50"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            )}
                            {(birthLine || diedDate) && (
                                <p className="text-xs text-slate-400 mb-2">
                                    {birthLine && <span>Born {birthLine}</span>}
                                    {birthLine && diedDate && <span className="mx-1">·</span>}
                                    {diedDate && <span>Died {diedDate}</span>}
                                </p>
                            )}
                            {personInfo?.biography && (
                                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                                    {personInfo.biography}
                                </p>
                            )}
                        </div>
                        {tmdbId && (
                            <a
                                href={tmdbPersonUrl(tmdbId)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300"
                            >
                                View on TMDb
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={2}
                                    stroke="currentColor"
                                    className="w-3.5 h-3.5"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                                    />
                                </svg>
                            </a>
                        )}
                    </div>
                )}

                {/* Scrollable Content Area */}
                {sortedFilmography.length === 0 ? (
                    <p className="relative z-10 p-4 md:p-6 text-slate-400 flex-grow">
                        No film credits found for {activePersonName}.
                    </p>
                ) : (
                    <div className="relative z-10 overflow-y-auto min-h-0 max-h-[29vh] flex-shrink-0 p-3 md:p-4 grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3 themed-scrollbar">
                        {sortedFilmography.map(({ film: creditFilm, roles }) => {
                            const character = getCharacterForPerson(creditFilm, personNameLower);
                            return (
                                <Link
                                    key={creditFilm.imdbID}
                                    to={`/films/${creditFilm.imdbID}`}
                                    onClick={onClose} // Close modal on navigation
                                    className={`group p-2 rounded-md flex items-start transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400
                              ${
                                  creditFilm.imdbID === currentFilmId
                                      ? 'bg-slate-700/70 ring-1 ring-blue-500 shadow-md'
                                      : 'bg-slate-800/40 hover:bg-slate-700/60'
                              }`}
                                >
                                    <img
                                        src={creditFilm.poster || '/placeholder-poster.png'}
                                        alt={`${creditFilm.title} poster`}
                                        className="flex-shrink-0 w-16 h-auto object-cover rounded shadow-sm border border-slate-600/50"
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.src = '/placeholder-poster.png';
                                            target.onerror = null;
                                        }}
                                    />
                                    <div className="ml-2 md:ml-3 min-w-0 flex-grow">
                                        <h3 className="text-sm font-semibold text-slate-100 leading-tight group-hover:text-blue-300">
                                            {creditFilm.title}
                                        </h3>
                                        {creditFilm.year && (
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                ({creditFilm.year})
                                            </p>
                                        )}
                                        <p className="text-xs text-slate-300 mt-1.5">
                                            <span className="font-medium text-slate-400">
                                                Role(s):
                                            </span>{' '}
                                            {roles.join(', ')}
                                        </p>
                                        {character && (
                                            <p className="text-xs text-slate-300 mt-0.5">
                                                <span className="font-medium text-slate-400">
                                                    as
                                                </span>{' '}
                                                <span className="italic">{character}</span>
                                            </p>
                                        )}
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </>
        </Modal>
    );
};

export default CreditsModal;
