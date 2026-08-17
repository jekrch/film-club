import React from 'react';
import Modal from './Modal';

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
const TrailerModal: React.FC<TrailerModalProps> = ({ isOpen, onClose, trailerKey, title }) => (
    <Modal
        isOpen={isOpen}
        onClose={onClose}
        eyebrow="Trailer"
        title={title}
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
