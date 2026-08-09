import React from 'react';
import { Film } from '../../types/film';
import { useFilmFrames } from '../../hooks/useFilmFrames';
import { FilmFrameCredit, FilmFrameImage } from './filmFrames';

interface HeroCollageBackgroundProps {
    films: Film[];
    className?: string;
}

/**
 * Peak strength of the two edge panels, stepped by breakpoint because the text
 * column is what has to stay readable and it only pulls away from the edges as
 * the viewport grows: on phones the copy runs nearly edge to edge, from `md`
 * it's capped and centered, and at `2xl` the banner bleeds wider still so the
 * outer thirds are pure art. The center panel sits under the text at every
 * size, so it stays low throughout.
 */
const STRENGTH_VARS = '[--hero-edge:0.28] md:[--hero-edge:0.46] 2xl:[--hero-edge:0.6] [--hero-center:0.15]';

/**
 * Where each frame sits in the banner, in the order they're filled.
 *
 * Fades are masks rather than a colored gradient on top: the cards these sit
 * in have no fill of their own, so anything painted over the image would be a
 * shade the page doesn't otherwise use. Each edge panel ramps from full
 * strength at the outer edge down to nothing by the time it reaches the text,
 * which is what lets the edges run bright without costing legibility.
 */
const PANELS = [
    {
        position: 'left-0 w-1/3',
        mask: 'linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,0.72) 38%, rgba(0,0,0,0.26) 72%, rgba(0,0,0,0) 100%)',
        opacity: 'var(--hero-edge)',
        // Credits hug the outer edge, under the brightest part of the frame
        // and away from the text column.
        caption: 'left-0 w-1/3 justify-start pl-3 sm:pl-5',
    },
    {
        position: 'right-0 w-1/3',
        mask: 'linear-gradient(to left, rgba(0,0,0,1) 0%, rgba(0,0,0,0.72) 38%, rgba(0,0,0,0.26) 72%, rgba(0,0,0,0) 100%)',
        opacity: 'var(--hero-edge)',
        caption: 'right-0 w-1/3 justify-end pr-3 sm:pr-5',
    },
    {
        // Behind the avatar and copy, so it only appears once there's
        // horizontal room for it and never rises above a wash.
        position: 'left-1/3 right-1/3 hidden md:block',
        mask: 'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 42%, rgba(0,0,0,1) 58%, rgba(0,0,0,0) 100%)',
        opacity: 'var(--hero-center)',
        caption: 'left-1/3 right-1/3 hidden md:flex justify-center',
    },
];

/** Top and bottom dissolve, applied to the collage as a whole. */
const VERTICAL_FADE = 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 15%, rgba(0,0,0,1) 85%, rgba(0,0,0,0) 100%)';

/**
 * The collage of stills washed behind a hero banner. Rendered by
 * {@link ./HeroBanner}, which is what pages should reach for.
 */
const HeroCollageBackground: React.FC<HeroCollageBackgroundProps> = ({ films, className = '' }) => {
    const frames = useFilmFrames(films, PANELS.length);

    // One lone frame reads as a mistake rather than a collage
    if (frames.length < 2) return null;

    return (
        <div className={`absolute inset-0 overflow-hidden pointer-events-none ${STRENGTH_VARS} ${className}`}>
            {/* The frames, masked as a group so the collage dissolves at the
                top and bottom of the card. */}
            <div
                className="absolute inset-0"
                style={{ WebkitMaskImage: VERTICAL_FADE, maskImage: VERTICAL_FADE }}
            >
                {frames.map((frame, index) => {
                    const panel = PANELS[index];
                    return (
                        <div
                            key={frame.imdbID}
                            className={`absolute top-0 bottom-0 overflow-hidden ${panel.position}`}
                            style={{
                                opacity: panel.opacity,
                                WebkitMaskImage: panel.mask,
                                maskImage: panel.mask,
                            }}
                        >
                            <FilmFrameImage frame={frame} />
                        </div>
                    );
                })}
            </div>

            {/* Credits for what's on screen, outside the mask above so the
                bottom fade doesn't take them with it. They clear the banner's
                own content (`z-30`) because on narrow screens the copy runs
                full width and its bottom padding would otherwise swallow the
                clicks — only the link itself takes pointer events, so the rest
                of the strip stays inert. */}
            {frames.map((frame, index) => (
                <div
                    key={frame.imdbID}
                    className={`absolute bottom-2 sm:bottom-3 z-40 flex ${PANELS[index].caption}`}
                >
                    <FilmFrameCredit frame={frame} />
                </div>
            ))}
        </div>
    );
};

export default HeroCollageBackground;
