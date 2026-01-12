import React, { useMemo } from 'react';

interface SelectionCommitteeBackgroundProps {
    imageUrl: string | undefined;
    className?: string;
    /** Manual X position for object-position (0-100). If not provided, uses random value between 20-60 */
    objectPositionX?: number;
    /** Manual Y position for object-position (0-100). If not provided, uses random value between 10-60 */
    objectPositionY?: number;
    /** Transform scale value. Defaults to 1.8 */
    scale?: number;
    /** Image opacity (0-1). Defaults to 0.25 */
    opacity?: number;
}

const SelectionCommitteeBackground: React.FC<SelectionCommitteeBackgroundProps> = ({ 
    imageUrl, 
    className = '',
    objectPositionX,
    objectPositionY,
    scale = 1.8,
    opacity = 0.25,
}) => {
    const segment = useMemo(() => {
        if (!imageUrl || imageUrl.includes('N/A')) return null;
        
        return {
            poster: imageUrl,
            clipX: objectPositionX ?? (20 + Math.random() * 40),
            clipY: objectPositionY ?? (10 + Math.random() * 50),
        };
    }, [imageUrl, objectPositionX, objectPositionY]);

    if (!segment) return null;

    return (
        <div className={`absolute inset-0 overflow-hidden pointer-events-none rounded-lg ${className}`}>
            <div
                className="absolute top-0 bottom-0 left-0 w-2/3 h-full"
                style={{
                    maskImage: 'linear-gradient(to right, black 0%, black 20%, transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(to right, black 0%, black 20%, transparent 100%)',
                }}
            >
                <img
                    src={segment.poster}
                    alt=""
                    aria-hidden="true"
                    className="w-full h-full object-cover"
                    style={{
                        objectPosition: `${segment.clipX}% ${segment.clipY}%`,
                        transform: `scale(${scale})`,
                        opacity,
                    }}
                    loading="lazy"
                />
            </div>
        </div>
    );
};

export default SelectionCommitteeBackground;