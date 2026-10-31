import React, { useState } from 'react';
import { DEFAULT_MEMBER_IMAGE, getMemberImage } from '../../types/team';

interface CircularImageProps {
    src?: string;
    alt?: string;
    size?: string;
    className?: string;
}

const CircularImage: React.FC<CircularImageProps> = ({
    src,
    alt = 'Profile photo',
    size = 'w-32 h-32',
    className = '',
}) => {
    const [hasError, setHasError] = useState(false);

    // Without a src the alt is the member's name, which is how most callers use this.
    const imageSrc = hasError ? DEFAULT_MEMBER_IMAGE : src || getMemberImage(alt);

    return (
        // Outer container clips the zooming image
        <div
            className={`${size} mx-auto bg-slate-700 rounded-full overflow-hidden border-2 border-slate-600 relative ${className}`}
        >
            <img
                src={imageSrc}
                alt={alt}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-110"
                style={{ objectPosition: 'center center' }}
                onError={() => {
                    console.error(`Failed to load image: ${imageSrc}`);
                    setHasError(true);
                }}
            />
        </div>
    );
};

export default CircularImage;
