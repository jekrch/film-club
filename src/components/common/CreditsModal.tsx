import React, { useMemo } from 'react';
import { Film } from '../../types/film';
import { Link } from 'react-router-dom';

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

  // The person's headshot isn't stored on a person record, so pull the first
  // available profile image from any film where they appear in the cast.
  const profileUrl = useMemo(() => {
    if (!filmography) return null;
    for (const { film } of filmography) {
      const match = film.cast?.find(member => member?.name?.trim().toLowerCase() === personNameLower);
      if (match?.profileUrl) return match.profileUrl;
    }
    return null;
  }, [filmography, personNameLower]);

  if (!isOpen || !personName || !filmography) return null;

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
        <div className="relative z-10 flex justify-between items-center p-4 md:p-5 border-b border-slate-700/60 flex-shrink-0">
          <h2 className="text-lg md:text-xl font-semibold text-slate-100 truncate pr-4">
            {personName}'s Credits
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 transition-colors rounded-full p-1.5 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
            aria-label="Close modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 md:w-6 md:h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

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
