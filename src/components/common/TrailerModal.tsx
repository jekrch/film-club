import React from 'react';
import Modal from './Modal';

interface TrailerModalProps {
    isOpen: boolean;
    onClose: () => void;
    trailerKey: string; // YouTube video key
    title: string; // Film title, used to name the dialog and the iframe
}

/**
 * Modal that lazily mounts a YouTube trailer iframe only while open, so the
 * embed (and any playback) starts on open and stops on close — the iframe stays
 * mounted through the brief close animation rather than cutting to black. Uses
 * the privacy-friendly youtube-nocookie host and autoplays on open.
 *
 * No header: the player is the whole dialog, and on a phone a title strip eats
 * height the video needs. Whoever clicked "Trailer" on a film knows what this
 * is, and the title still names the dialog for screen readers.
 */
const TrailerModal: React.FC<TrailerModalProps> = ({ isOpen, onClose, trailerKey, title }) => (
    <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`${title} trailer`}
        hideHeader
        className="max-w-3xl"
        accent="blue"
    >
        <div className="relative w-full aspect-video bg-black">
            <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1`}
                title={`${title} trailer`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
            />
        </div>
    </Modal>
);

export default TrailerModal;
