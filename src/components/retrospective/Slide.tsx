import React from 'react';
import { motion } from 'framer-motion';
import { prefersReducedMotion } from '../../utils/motion';
import { useSqueeze } from '../../hooks/useSqueeze';
import { beat } from './slides/format';

interface SlideProps {
    children: React.ReactNode;
    /**
     * The slide's reel of film. The deck draws the reel itself, one strip that
     * runs on from slide to slide (see Story); a slide with stills here makes
     * room for it at its top on a phone.
     */
    reel?: string[];
    /**
     * On a phone, run the reel behind the slide rather than above it, so
     * something tall can rise over it and use the height the reel would take.
     */
    reelBehind?: boolean;
    /**
     * Where the words sit: centred, or down at the bottom like a title over a
     * frame, for a slide that lets the film's stills fill the screen.
     */
    align?: 'center' | 'bottom';
    className?: string;
}

/**
 * One viewport-high panel of the deck.
 *
 * It fills the space above the deck's bottom bar, which is where the
 * soundtrack's player lives, so nothing on a slide is ever drawn under it.
 * The art behind it belongs to the deck, which keeps one wall for every slide;
 * a slide may ask for the deck's reel of film, which runs across its top on
 * a phone and through the bottom bar on anything wider.
 *
 * A slide that is only a little too tall for the room is squeezed to fit: the
 * dimensions it has marked as able to give way (see `give` and
 * {@link useSqueeze}) give just as much as it takes. One that is too tall for
 * that scrolls at full size.
 */
const Slide: React.FC<SlideProps> = ({
    children,
    reel,
    reelBehind = false,
    align = 'center',
    className = '',
}) => {
    const fit = useSqueeze();
    const hasReel = !!reel?.length;
    /** The reel takes room at the top: on a phone, unless it runs behind. */
    const reelAbove = hasReel && !reelBehind;
    return (
        <div className="absolute inset-0 flex flex-col overflow-hidden pt-8 sm:pt-9">
            {/* On a phone the deck's reel runs right under the progress bar, and
            this is its room: the reel's height, h-14 of frames between two
            h-2.5 margins (see PhoneReel in Story). Wider, it runs through the
            deck's bottom bar instead. */}
            {reelAbove && <div className="h-[4.75rem] shrink-0 sm:hidden" aria-hidden="true" />}
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
                <div
                    ref={fit.contentRef}
                    className={`w-full max-w-3xl ${align === 'bottom' ? 'mx-auto mt-auto' : 'm-auto'}`}
                >
                    {children}
                </div>
            </div>
        </div>
    );
};

/**
 * A line of a slide that fades in after `step` beats. The beats are short, so
 * a slide arrives nearly whole, like a cut, rather than assembling line by
 * line; motion is left to the things that mean something, like bars growing.
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
            initial={still ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, delay: beat(step), ease: 'easeOut' }}
        >
            {children}
        </motion.div>
    );
};

/** The line that names a slide: set like a heading in a printed programme. */
export const Eyebrow: React.FC<{ children: React.ReactNode; color?: string }> = ({
    children,
    color,
}) => (
    <p
        className="font-serif text-xl italic leading-snug text-slate-300 group-data-[clear-close]/slide:pr-12 sm:text-2xl sm:group-data-[clear-close]/slide:pr-0"
        style={color ? { color } : undefined}
    >
        {children}
    </p>
);

export default Slide;
