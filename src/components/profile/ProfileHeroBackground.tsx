import React, { useMemo } from 'react';
import { Film } from '../../types/film';
import { getFilmBackdrops } from '../../utils/filmUtils';

interface ProfileHeroBackgroundProps {
    films: Film[];
    className?: string;
}

/**
 * The image pool for a film: its scene stills when it has any, otherwise its
 * poster as a fallback. Returns an empty array when the film has neither.
 */
const getFilmHeroImages = (film: Film): string[] => {
    const stills = getFilmBackdrops(film);
    if (stills.length > 0) return stills;
    if (film.poster && !film.poster.includes('N/A')) return [film.poster];
    return [];
};

const pickRandom = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

const SLATE = 'rgb(30, 41, 59)';

/**
 * Where each frame sits in the banner, in the order they're filled. The center
 * panel sits behind the avatar and bio, so it's dimmer and only appears once
 * there's horizontal room for it.
 */
const PANELS = [
    {
        position: 'left-0 w-1/3',
        fade: `linear-gradient(to right, transparent 0%, ${SLATE} 100%)`,
        opacity: 0.25,
    },
    {
        position: 'right-0 w-1/3',
        fade: `linear-gradient(to left, transparent 0%, ${SLATE} 100%)`,
        opacity: 0.25,
    },
    {
        position: 'left-1/3 right-1/3 hidden md:block',
        fade: `linear-gradient(to right, ${SLATE} 0%, transparent 40%, transparent 60%, ${SLATE} 100%)`,
        opacity: 0.14,
    },
];

const ProfileHeroBackground: React.FC<ProfileHeroBackgroundProps> = ({ films, className = '' }) => {
    const segments = useMemo(() => {
        // Keep films that can contribute imagery (scene stills preferred, poster as fallback)
        const candidates = films
            .map(film => ({ film, images: getFilmHeroImages(film) }))
            .filter(({ images }) => images.length > 0);
        if (candidates.length < 2) return [];

        // Shuffle and pick a different film per panel, then a random frame from
        // each (different on each page load)
        const shuffled = [...candidates].sort(() => Math.random() - 0.5);

        return shuffled.slice(0, PANELS.length).map(({ film, images }) => {
            const image = pickRandom(images);
            const isPoster = image === film.poster;
            return {
                imdbID: film.imdbID,
                image,
                // Posters are portrait, so they need a hard zoom to fill the tall
                // edge column; wide stills only need a gentle one
                scale: isPoster ? 1.8 : 1.15,
                // Random portion of the image to show
                clipX: 20 + Math.random() * 60,
                clipY: isPoster ? 10 + Math.random() * 50 : 25 + Math.random() * 50,
            };
        });
    }, [films]);

    if (segments.length < 2) return null;

    return (
        <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
            {segments.map((segment, index) => {
                const panel = PANELS[index];
                return (
                    <div
                        key={segment.imdbID}
                        className={`absolute top-0 bottom-0 overflow-hidden ${panel.position}`}
                        style={{ opacity: panel.opacity }}
                    >
                        <img
                            src={segment.image}
                            alt=""
                            aria-hidden="true"
                            className="w-full h-full object-cover"
                            style={{
                                objectPosition: `${segment.clipX}% ${segment.clipY}%`,
                                transform: `scale(${segment.scale})`,
                            }}
                            loading="lazy"
                        />
                        {/* Fade into the surrounding card */}
                        <div className="absolute inset-0" style={{ background: panel.fade }} />
                    </div>
                );
            })}

            {/* Top and bottom fade */}
            <div 
                className="absolute inset-0" 
                style={{
                    background: 'linear-gradient(to bottom, rgb(30, 41, 59) 0%, transparent 15%, transparent 85%, rgb(30, 41, 59) 100%)',
                }}
            />
        </div>
    );
};

export default ProfileHeroBackground;