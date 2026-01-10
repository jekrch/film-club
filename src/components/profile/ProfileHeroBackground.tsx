import React, { useMemo } from 'react';
import { Film } from '../../types/film';

interface ProfileHeroBackgroundProps {
    films: Film[];
    className?: string;
}

const ProfileHeroBackground: React.FC<ProfileHeroBackgroundProps> = ({ films, className = '' }) => {
    const segments = useMemo(() => {
        // Filter films that have posters (and not the N/A placeholder)
        const filmsWithPosters = films.filter(f => f.poster && !f.poster.includes('N/A'));
        if (filmsWithPosters.length < 2) return [];

        // Shuffle and pick 2 random films (different on each page load)
        const shuffled = [...filmsWithPosters].sort(() => Math.random() - 0.5);
        const selectedFilms = shuffled.slice(0, 2);
        
        return selectedFilms.map((film) => ({
            imdbID: film.imdbID,
            poster: film.poster,
            // Random portion of the poster to show
            clipX: 20 + Math.random() * 40,
            clipY: 10 + Math.random() * 50,
        }));
    }, [films]);

    if (segments.length < 2) return null;

    return (
        <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
            {/* Left edge poster */}
            <div 
                className="absolute top-0 bottom-0 left-0 w-1/3 overflow-hidden"
                style={{ opacity: 0.25 }}
            >
                <img
                    src={segments[0].poster}
                    alt=""
                    aria-hidden="true"
                    className="w-full h-full object-cover"
                    style={{
                        objectPosition: `${segments[0].clipX}% ${segments[0].clipY}%`,
                        transform: 'scale(1.8)',
                    }}
                    loading="lazy"
                />
                {/* Fade toward center */}
                <div 
                    className="absolute inset-0"
                    style={{
                        background: 'linear-gradient(to right, transparent 0%, rgb(30, 41, 59) 100%)',
                    }}
                />
            </div>

            {/* Right edge poster */}
            <div 
                className="absolute top-0 bottom-0 right-0 w-1/3 overflow-hidden"
                style={{ opacity: 0.25 }}
            >
                <img
                    src={segments[1].poster}
                    alt=""
                    aria-hidden="true"
                    className="w-full h-full object-cover"
                    style={{
                        objectPosition: `${segments[1].clipX}% ${segments[1].clipY}%`,
                        transform: 'scale(1.8)',
                    }}
                    loading="lazy"
                />
                {/* Fade toward center */}
                <div 
                    className="absolute inset-0"
                    style={{
                        background: 'linear-gradient(to left, transparent 0%, rgb(30, 41, 59) 100%)',
                    }}
                />
            </div>

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