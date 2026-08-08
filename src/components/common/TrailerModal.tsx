import React from 'react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useModalPresence } from '../../hooks/useModalPresence';
import Button from './Button';

interface TrailerModalProps {
  isOpen: boolean;
  onClose: () => void;
  trailerKey: string; // YouTube video key
  title: string; // Film title, used for the heading and iframe label
}

/**
 * Modal that lazily mounts a YouTube trailer iframe only while open, so the
 * embed (and any playback) starts on open and stops on close — the iframe stays
 * mounted through the brief close animation rather than cutting to black. Uses
 * the privacy-friendly youtube-nocookie host and autoplays on open.
 */
const TrailerModal: React.FC<TrailerModalProps> = ({ isOpen, onClose, trailerKey, title }) => {
  const { isRendered, isClosing } = useModalPresence(isOpen);

  // Prevent scrolling the page behind the modal while it's open (and while it
  // animates out, so the page doesn't jump before the modal is gone).
  useBodyScrollLock(isRendered);

  if (!isRendered) return null;

  return (
    <div
      className={`fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 ${
        isClosing ? 'animate-fadeOut pointer-events-none' : 'animate-fadeIn'
      }`}
      onClick={onClose}
    >
      <div
        className={`bg-slate-800 text-slate-200 rounded-lg shadow-2xl max-w-3xl w-full flex flex-col overflow-hidden ${
          isClosing ? 'animate-scaleOut' : 'animate-scaleIn'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 md:p-5 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-lg md:text-xl font-semibold text-slate-100 truncate pr-4">
            {title} — Trailer
          </h2>
          <Button
            onClick={onClose}
            variant="ghost"
            aria-label="Close trailer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 md:w-6 md:h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
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
