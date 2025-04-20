import React, { useState } from 'react';

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
  className = ''
}) => {
  const [hasError, setHasError] = useState(false);

  if (!src) {
    src = `/film-club/images/${alt?.toLowerCase()}.jpg`; // Default image path
  }

  return (
    // Outer container clips the zooming image
    <div
      className={`${size} mx-auto bg-slate-700 rounded-full overflow-hidden border-2 border-slate-600 relative ${className}`}
    >
      {hasError ? (
        // Person icon fallback
        <svg 
          className="w-full h-full text-slate-400" 
          viewBox="0 0 24 24" 
          fill="currentColor"
        >
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
        </svg>
      ) : (
        <img
          src={src}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-110"
          style={{ objectPosition: 'center center' }}
          onError={() => {
            console.error(`Failed to load image: ${src}`);
            setHasError(true);
          }}
        />
      )}
    </div>
  );
};

export default CircularImage;