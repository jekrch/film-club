import React, { useMemo } from 'react';
import { Film } from '../../types/film';
import { Link } from 'react-router-dom';
import { getPersonInfoByName, getPersonProfileByName, tmdbPersonUrl } from '../../utils/personUtils';

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
  const match = film.cast?.find(member => member?.name?.trim().toLowerCase() === personNameLower);
  const character = match?.character?.trim();
  return character ? character : null;
};

const CreditsModal: React.FC<CreditsModalProps> = ({ isOpen, onClose, personName, filmography, currentFilmId }) => {
  const personNameLower = (personName ?? '').trim().toLowerCase();

  // Normalized TMDb record (bio, birth/death, known-for, canonical headshot)
  // resolved from the person's name, if we have one for them.
  const personInfo = useMemo(() => getPersonInfoByName(personName), [personName]);
  const tmdbId = useMemo(() => getPersonProfileByName(personName)?.tmdbId, [personName]);

  // Prefer a per-film cast headshot (closest to the credit shown); fall back to
  // the canonical TMDb portrait so crew members with no cast entry still get a photo.
  const profileUrl = useMemo(() => {
    if (filmography) {
      for (const { film } of filmography) {
        const match = film.cast?.find(member => member?.name?.trim().toLowerCase() === personNameLower);
        if (match?.profileUrl) return match.profileUrl;
      }
    }
    return personInfo?.profileUrl ?? null;
  }, [filmography, personNameLower, personInfo]);

  if (!isOpen || !personName || !filmography) return null;

  const bornDate = formatPersonDate(personInfo?.birthday);
  const diedDate = formatPersonDate(personInfo?.deathday);
  const birthLine = [bornDate, personInfo?.placeOfBirth].filter(Boolean).join(' · ');
  const hasPersonDetails = !!(
    personInfo?.biography || birthLine || diedDate || personInfo?.knownForDepartment || tmdbId
  );

  // Sort filmography: by year descending, then by title ascending
  const sortedFilmography = [...filmography].sort((a, b) => {
    const yearComparison = (b.film.year || '0').localeCompare(a.film.year || '0');
    if (yearComparison !== 0) return yearComparison;
    return (a.film.title || '').localeCompare(b.film.title || '');
  });

  return (
    // Dialog Overlay: Semi-transparent backdrop
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose} // Allow closing by clicking overlay
    >
      {/* Dialog Content: Modal panel. The person's headshot is a full-height
          background on the right, fading out toward the left so the credits
          stay legible while the photo continues down through the whole modal. */}
      <div
        className="relative bg-slate-800 text-slate-200 rounded-lg shadow-2xl max-w-xl md:max-w-2xl w-full max-h-[90vh] flex flex-col animate-scaleIn overflow-hidden"
        onClick={(e) => e.stopPropagation()} // Prevent clicks inside modal from closing it
      >
        {profileUrl && (
          <>
            <img
              src={profileUrl}
              alt=""
              aria-hidden="true"
              className="absolute right-0 top-0 h-full w-2/3 object-cover object-top pointer-events-none"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            {/* Gradient fades the photo out aggressively toward the left, keeping text legible */}
            <div className="absolute inset-0 bg-gradient-to-r from-slate-800 from-40% via-slate-800/95 to-slate-800/10 pointer-events-none" />
          </>
        )}

        {/* Dialog Header */}
        <div className="relative z-10 flex justify-between items-start p-4 md:p-5 border-b border-slate-700/60 flex-shrink-0">
          <div className="min-w-0 pr-4">
            <h2 className="text-lg md:text-xl font-semibold text-slate-100 truncate">
              {personName}
            </h2>
            {personInfo?.knownForDepartment && (
              <p className="text-xs text-slate-400 mt-0.5">{personInfo.knownForDepartment}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 transition-colors rounded-full p-1.5 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 flex-shrink-0"
            aria-label="Close modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 md:w-6 md:h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Person details: bio, birth/death, and a link to the full TMDb profile. */}
        {hasPersonDetails && (
          <div className="relative z-10 px-4 md:px-5 py-3 border-b border-slate-700/60 flex-shrink-0 space-y-2">
            {(birthLine || diedDate) && (
              <p className="text-xs text-slate-400">
                {birthLine && <span>Born {birthLine}</span>}
                {birthLine && diedDate && <span className="mx-1">·</span>}
                {diedDate && <span>Died {diedDate}</span>}
              </p>
            )}
            {personInfo?.biography && (
              <p className="text-sm text-slate-300 leading-relaxed max-h-32 overflow-y-auto themed-scrollbar pr-2">
                {personInfo.biography}
              </p>
            )}
            {tmdbId && (
              <a
                href={tmdbPersonUrl(tmdbId)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300"
              >
                View on TMDb
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            )}
          </div>
        )}

        {/* Scrollable Content Area */}
        {sortedFilmography.length === 0 ? (
          <p className="relative z-10 p-4 md:p-6 text-slate-400 flex-grow">No film credits found for {personName}.</p>
        ) : (
          <div className="relative z-10 overflow-y-auto flex-grow p-3 md:p-4 space-y-3 themed-scrollbar">
            {sortedFilmography.map(({ film: creditFilm, roles }) => {
              const character = getCharacterForPerson(creditFilm, personNameLower);
              return (
                <Link
                  key={creditFilm.imdbID}
                  to={`/films/${creditFilm.imdbID}`}
                  onClick={onClose} // Close modal on navigation
                  className={`group p-3 rounded-md flex items-start transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400
                              ${creditFilm.imdbID === currentFilmId
                                ? 'bg-slate-700/70 ring-1 ring-blue-500 shadow-md'
                                : 'bg-slate-800/40 hover:bg-slate-700/60'}`}
                >
                  <img
                    src={creditFilm.poster || '/placeholder-poster.png'}
                    alt={`${creditFilm.title} poster`}
                    className="flex-shrink-0 w-25 h-auto object-cover rounded shadow-sm border border-slate-600/50"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/placeholder-poster.png';
                      target.onerror = null;
                    }}
                  />
                  <div className="ml-3 md:ml-4 flex-grow">
                    <h3 className="text-base md:text-lg font-semibold text-slate-100 leading-tight group-hover:text-blue-300">{creditFilm.title}</h3>
                    {creditFilm.year && <p className="text-xs text-slate-400 mt-1">({creditFilm.year})</p>}
                    <p className="text-sm text-slate-300 mt-4">
                      <span className="font-medium text-slate-400">Role(s):</span> {roles.join(', ')}
                    </p>
                    {character && (
                      <p className="text-sm text-slate-300 mt-1">
                        <span className="font-medium text-slate-400">as</span> <span className="italic">{character}</span>
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CreditsModal;
