import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FilmFrame } from '../../hooks/useFilmFrames';

/** A framed still that fades in once it has decoded. */
export const FilmFrameImage: React.FC<{ frame: FilmFrame }> = ({ frame }) => {
    const [loaded, setLoaded] = useState(false);

    // Reset the fade-in whenever the image source changes
    useEffect(() => {
        setLoaded(false);
    }, [frame.image]);

    return (
        <img
            src={frame.image}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover transition-opacity duration-700 ease-out"
            style={{
                objectPosition: `${frame.clipX}% ${frame.clipY}%`,
                transform: `scale(${frame.scale})`,
                opacity: loaded ? 1 : 0,
            }}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            ref={(node) => { if (node?.complete) setLoaded(true); }}
        />
    );
};

/**
 * The quiet credit line naming the film a frame came from, linking to it.
 *
 * `pointer-events-auto` because the layers these sit in are inert as a whole;
 * only the link itself should take clicks. Its color comes from the
 * `.hero-credit` rule in index.css — see the comment there.
 */
export const FilmFrameCredit: React.FC<{ frame: FilmFrame; className?: string }> = ({
    frame,
    className = '',
}) => (
    <Link
        to={`/films/${frame.imdbID}`}
        title={frame.title}
        className={`hero-credit pointer-events-auto max-w-full truncate text-[10px] uppercase tracking-[0.18em] transition-colors ${className}`}
    >
        {frame.title}
    </Link>
);
