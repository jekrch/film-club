import React from 'react';
import { Film } from '../../types/film'; 
import { Link } from 'react-router-dom';

interface CreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  personName: string | null;
  filmography: Array<{ film: Film; roles: string[] }> | null;
  currentFilmId?: string; // To highlight the current film in the list
}

const CreditsModal: React.FC<CreditsModalProps> = ({ isOpen, onClose, personName, filmography, currentFilmId }) => {
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
      {/* Dialog Content: Modal panel */}
      <div
        className="bg-slate-800 text-slate-200 rounded-lg shadow-2xl max-w-xl md:max-w-2xl w-full max-h-[90vh] flex flex-col animate-scaleIn overflow-hidden"
        onClick={(e) => e.stopPropagation()} // Prevent clicks inside modal from closing it
      >
        {/* Dialog Header */}
        <div className="flex justify-between items-center p-4 md:p-5 border-b border-slate-700 flex-shrink-0">
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
          <p className="p-4 md:p-6 text-slate-400 flex-grow">No film credits found for {personName}.</p>
        ) : (
          <div className="overflow-y-auto flex-grow p-3 md:p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-700">
            {sortedFilmography.map(({ film: creditFilm, roles }) => (
              <div
                key={creditFilm.imdbID}
                className={`p-3 rounded-md flex items-start transition-colors
                            ${creditFilm.imdbID === currentFilmId 
                              ? 'bg-slate-700 ring-1 ring-blue-500 shadow-md' 
                              : 'bg-slate-700/40 hover:bg-slate-600/70'}`}
              >
                <Link 
                  to={`/films/${creditFilm.imdbID}`} 
                  onClick={onClose} // Close modal on navigation
                  className="flex-shrink-0 block focus:outline-none focus:ring-2 focus:ring-blue-400 rounded"
                >
                  <img
                    src={creditFilm.poster || '/placeholder-poster.png'}
                    alt={`${creditFilm.title} poster`}
                    className="w-20 h-auto object-cover rounded shadow-sm border border-slate-600/50"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/placeholder-poster.png';
                      target.onerror = null;
                    }}
                  />
                </Link>
                <div className="ml-3 md:ml-4 flex-grow">
                  <Link 
                    to={`/films/${creditFilm.imdbID}`} 
                    onClick={onClose} // Close modal on navigation
                    className="hover:underline focus:outline-none focus:text-blue-300"
                  >
                    <h3 className="text-base md:text-lg font-semibold text-slate-100 leading-tight">{creditFilm.title}</h3>
                  </Link>
                  {creditFilm.year && <p className="text-xs text-slate-400 mb-1">({creditFilm.year})</p>}
                  <p className="text-xs text-slate-300">
                    <span className="font-medium text-slate-400">Role(s):</span> {roles.join(', ')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CreditsModal;
