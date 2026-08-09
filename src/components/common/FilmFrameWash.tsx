import React from 'react';
import { Film } from '../../types/film';
import { useFilmFrames } from '../../hooks/useFilmFrames';
import { FilmFrameCredit, FilmFrameImage } from './filmFrames';

interface FilmFrameWashProps {
    /** Films the frames are drawn from. The wash picks its own. */
    films: Film[];
    className?: string;
}

/**
 * Two frames stacked in from the right edge, brightest at the edge and
 * dissolving into the card by halfway across — the same falloff as the hero
 * banner, sized for a card whose copy is left-aligned and can run long. The
 * strengths meet at the seam (0.34 x 0.5 and 0.2 x 0.85 both land on 0.17), so
 * the pair reads as one wash rather than two panels.
 */
const FRAMES = [
    {
        position: 'right-0 w-[26%]',
        opacity: 0.34,
        mask: 'linear-gradient(to left, rgba(0,0,0,1) 0%, rgba(0,0,0,0.5) 100%)',
    },
    {
        position: 'right-[26%] w-[24%]',
        opacity: 0.2,
        mask: 'linear-gradient(to left, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)',
    },
];

/**
 * Holds the frames off the card's header row, which is text across the full
 * width. Below that the copy is short enough that the right edge is free.
 */
const VERTICAL_FADE = 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.35) 22%, rgba(0,0,0,1) 55%, rgba(0,0,0,1) 100%)';

/**
 * Stills from a set of films washed into the right edge of a card, credited
 * with a link to the film in the bottom corner.
 *
 * Positions itself absolutely and is inert apart from that credit, so it drops
 * into any `relative` container — pass it to AccentCard's `decoration` slot
 * rather than as a child, so it spans the card rather than its padding box.
 */
const FilmFrameWash: React.FC<FilmFrameWashProps> = ({ films, className = '' }) => {
    const frames = useFilmFrames(films, FRAMES.length);

    if (frames.length === 0) return null;

    return (
        <div className={`pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] ${className}`}>
            <div
                className="absolute inset-0"
                style={{ WebkitMaskImage: VERTICAL_FADE, maskImage: VERTICAL_FADE }}
            >
                {frames.map((frame, index) => (
                    <div
                        key={frame.imdbID}
                        className={`absolute top-0 bottom-0 overflow-hidden ${FRAMES[index].position}`}
                        style={{
                            opacity: FRAMES[index].opacity,
                            WebkitMaskImage: FRAMES[index].mask,
                            maskImage: FRAMES[index].mask,
                        }}
                    >
                        <FilmFrameImage frame={frame} />
                    </div>
                ))}
            </div>

            {/* Credits the frame at the edge — the one actually legible. Kept
                out of the fade above and above the card's content layer so the
                link stays clickable. */}
            <div className="absolute bottom-1.5 right-3 z-20 flex max-w-[55%] justify-end">
                <FilmFrameCredit frame={frames[0]} />
            </div>
        </div>
    );
};

export default FilmFrameWash;
