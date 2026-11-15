import React from 'react';
import { motion } from 'framer-motion';
import { prefersReducedMotion } from '../../utils/motion';
import { useSqueeze } from '../../hooks/useSqueeze';
import FilmReel from './FilmReel';

interface SlideProps {
    children: React.ReactNode;
    /** Stills for a reel of film running across the top of the slide. */
    reel?: string[];
    /**
     * On a phone, run the reel behind the slide rather than above it, so
     * something tall can rise over it and use the height the reel would take.
     */
    reelBehind?: boolean;
    className?: string;
}

/**
 * One viewport-high panel of the deck.
 *
 * It fills the space above the deck's bottom bar, which is where the
 * soundtrack's player lives, so nothing on a slide is ever drawn under it.
 * The art behind it belongs to the deck, which keeps one wall for every slide;
 * a slide may add a reel of film, which runs across its top on a phone and
 * through the bottom bar on anything wider.
 *
 * A slide that is only a little too tall for the room is squeezed to fit: the
 * dimensions it has marked as able to give way (see `give` and
 * {@link useSqueeze}) give just as much as it takes. One that is too tall for
 * that scrolls at full size.
 */
const Slide: React.FC<SlideProps> = ({ children, reel, reelBehind = false, className = '' }) => {
    const fit = useSqueeze();
    const hasReel = !!reel?.length;
    /** The reel takes room at the top: on a phone, unless it runs behind. */
    const reelAbove = hasReel && !reelBehind;
    return (
        <div className="absolute inset-0 flex flex-col overflow-hidden pt-8 sm:pt-9">
            {/* On a phone the reel tucks in right under the progress bar; wider,
            it runs through the deck's bottom bar instead (see Story). */}
            {reel && hasReel && (
                <Reveal
                    step={-1}
                    className={`shrink-0 sm:hidden ${reelBehind ? 'absolute inset-x-0 top-8' : ''}`}
                >
                    <FilmReel stills={reel} frameClass="h-14" sprocketClass="h-2.5" />
                </Reveal>
            )}
            {/* Without a reel, a phone starts the slide level with the close
            button rather than below it, and the eyebrow keeps clear of it. */}
            <div
                ref={fit.frameRef}
                data-clear-close={reelAbove ? undefined : ''}
                className={`group/slide retro-scrollbar relative flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-6 pb-6 sm:px-12 sm:pt-1 sm:pb-6 lg:px-20 ${
                    reelAbove ? 'pt-6' : 'pt-2'
                } ${className}`}
            >
                {/* Auto margins in a scrolling column: centred when the slide fits,
                and nothing at all when it doesn't, so a tall slide starts at
                the top rather than being cut off above it. The padding is a
                little heavier below than above, which sets the centre a touch
                high, where it reads as centred. */}
                <div ref={fit.contentRef} className="m-auto w-full max-w-3xl">
                    {children}
                </div>
            </div>
        </div>
    );
};

/**
 * A line of a slide that rises into place, after `step` beats. Every slide
 * reveals its lines in order, which is what gives a deck its pace.
 */
export const Reveal: React.FC<{
    step?: number;
    children: React.ReactNode;
    className?: string;
}> = ({ step = 0, children, className }) => {
    const still = prefersReducedMotion();
    return (
        <motion.div
            className={className}
            initial={still ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            // After the slide's own fade-in has begun, then a beat per line.
            transition={{ duration: 0.6, delay: 0.45 + step * 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
            {children}
        </motion.div>
    );
};

/** The small-caps line above a slide's figure. */
export const Eyebrow: React.FC<{ children: React.ReactNode; color?: string }> = ({
    children,
    color,
}) => (
    <p
        className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 group-data-[clear-close]/slide:pr-12 sm:text-sm sm:group-data-[clear-close]/slide:pr-0"
        style={color ? { color } : undefined}
    >
        {children}
    </p>
);

export default Slide;
