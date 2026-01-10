import React, { useMemo } from 'react';
import { Film } from '../../types/film';

interface SelectionCommitteeBackgroundProps {
    upNextFilm: Film | undefined;
    className?: string;
}

const SelectionCommitteeBackground: React.FC<SelectionCommitteeBackgroundProps> = ({ 
    upNextFilm, 
    className = '' 
}) => {
    const segment = useMemo(() => {
        if (!upNextFilm?.poster || upNextFilm.poster.includes('N/A')) return null;
        
        return {
            poster: upNextFilm.poster,
            // Random portion of the poster to show
            clipX: 20 + Math.random() * 40,
            clipY: 10 + Math.random() * 50,
        };
    }, [upNextFilm]);

    if (!segment) return null;

    return (
        <div className={`absolute inset-0 overflow-hidden pointer-events-none rounded-lg ${className}`}>
            {/* Left edge poster only */}
            <div 
                className="absolute top-0 bottom-0 left-0 w-1/2 overflow-hidden"
            >
                <img
                    src={segment.poster}
                    alt=""
                    aria-hidden="true"
                    className="w-full h-full object-cover"
                    style={{
                        objectPosition: `${segment.clipX}% ${segment.clipY}%`,
                        transform: 'scale(2.8)',
                        opacity: 0.25,
                        maskImage: 'linear-gradient(to right, black 0%, transparent 100%)',
                        WebkitMaskImage: 'linear-gradient(to right, black 0%, transparent 100%)',
                    }}
                    loading="lazy"
                />
            </div>
        </div>
    );
};

export default SelectionCommitteeBackground;