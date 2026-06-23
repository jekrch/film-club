import React from 'react';

interface TrailerModalProps {
  isOpen: boolean;
  onClose: () => void;
  trailerKey: string; // YouTube video key
  title: string; // Film title, used for the heading and iframe label
}

/**
 * Modal that lazily mounts a YouTube trailer iframe only while open, so the
 * embed (and any playback) starts on open and stops on close. Uses the
 * privacy-friendly youtube-nocookie host and autoplays on open.
 */
const TrailerModal: React.FC<TrailerModalProps> = ({ isOpen, onClose, trailerKey, title }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 text-slate-200 rounded-lg shadow-2xl max-w-3xl w-full flex flex-col animate-scaleIn overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 md:p-5 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-lg md:text-xl font-semibold text-slate-100 truncate pr-4">
            {title} — Trailer
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 transition-colors rounded-full p-1.5 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
            aria-label="Close trailer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 md:w-6 md:h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="relative w-full aspect-video bg-black">
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1`}
            title={`${title} trailer`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
};

export default TrailerModal;
