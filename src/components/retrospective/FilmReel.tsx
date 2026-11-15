import React, { useMemo, useState } from 'react';
import { useMarquee } from '../../hooks/useMarquee';

interface FilmReelProps {
    stills: string[];
    /** Run right-to-left (the default) or the other way, so stacked reels can cross. */
    reverse?: boolean;
    /** The frames' height; their width follows at 16:9. */
    frameClass?: string;
    /** The sprocket margins' height. */
    sprocketClass?: string;
    className?: string;
}

/** Enough frames that the reel is wider than any screen before it repeats. */
const MIN_FRAMES = 14;

/**
 * A strip of film running across the slide: a row of stills between two
 * sprocket-holed margins, travelling slowly sideways and looping without a
 * seam, at the one pace every reel shares (see `useMarquee`). The frames are
 * the films the slide is about. Reduced motion holds it still.
 */
const FilmReel: React.FC<FilmReelProps> = ({
    stills,
    reverse,
    frameClass = 'h-16 sm:h-28 lg:h-32',
    sprocketClass = 'h-3 sm:h-4',
    className = '',
}) => {
    const [failed, setFailed] = useState<Set<string>>(() => new Set());
    const frames = useMemo(() => {
        const usable = stills.filter((url) => url && !failed.has(url));
        if (!usable.length) return [];
        const filled: string[] = [];
        while (filled.length < MIN_FRAMES) filled.push(...usable);
        return filled;
    }, [stills, failed]);

    const marquee = useMarquee(frames.length, reverse);

    if (!frames.length) return null;
    const sprockets = `${sprocketClass} bg-[repeating-linear-gradient(90deg,transparent_0_6px,rgba(242,245,248,0.55)_6px_14px,transparent_14px_22px)] [background-size:22px_55%] [background-position:0_center] bg-repeat-x`;

    return (
        <div
            className={`pointer-events-none w-full overflow-hidden bg-black/85 shadow-2xl ${className}`}
            aria-hidden="true"
        >
            <div className={sprockets} />
            <div
                ref={marquee.ref}
                className={`flex w-max gap-1.5 px-1 ${marquee.className}`}
                style={marquee.style}
            >
                {/* Twice over, so the second copy slides in as the first leaves. */}
                {[...frames, ...frames].map((url, i) => (
                    <img
                        key={`${url}-${i}`}
                        src={url}
                        alt=""
                        loading={i < 8 ? 'eager' : 'lazy'}
                        decoding="async"
                        className={`aspect-video shrink-0 rounded-[2px] object-cover ${frameClass}`}
                        onError={() => setFailed((prev) => new Set(prev).add(url))}
                    />
                ))}
            </div>
            <div className={sprockets} />
        </div>
    );
};

export default FilmReel;
