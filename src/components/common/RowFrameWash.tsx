import React from 'react';
import { FrameImage } from '../../utils/frameSources';

interface RowFrameWashProps {
    /** The row's own art. Null renders nothing, which is the empty-poster case. */
    image: FrameImage | null;
    className?: string;
}

/**
 * How far in from the right the art reaches, and how hard it has to be zoomed.
 *
 * A row is a wide, short strip. A still is already that shape and needs almost
 * no zoom; a poster is portrait, so filling the strip means cropping to a band
 * across its middle — hence the harder scale and the higher focal point, which
 * lands on the artwork rather than the title block at the bottom.
 */
const FRAMING: Record<FrameImage['kind'], { scale: number; position: string; opacity: string }> = {
    still: {
        scale: 1.05,
        position: 'center 35%',
        opacity: 'opacity-[0.17] group-hover:opacity-[0.29]',
    },
    // Posters run brighter and busier than scene stills, so the same opacity
    // would read as a louder wash rather than a matching one. Written out
    // rather than computed: Tailwind can't see a class name it didn't find in
    // the source, the same reason AccentCard keeps static accent maps.
    poster: {
        scale: 1.35,
        position: 'center 28%',
        opacity: 'opacity-[0.13] group-hover:opacity-[0.22]',
    },
};

/**
 * One film's art washed into the right edge of a list or watch-log row, fading
 * out well before it reaches the text.
 *
 * The card-level counterpart is {@link ./FilmFrameWash}, which stacks two frames
 * from a whole collection; a row is about one film, so this is one image and
 * nothing is randomized — a row re-rolling its crop mid-scroll would read as a
 * glitch. It brightens on hover along with the rest of the row.
 *
 * Positions itself absolutely and is inert, so it drops into any `relative`,
 * `overflow-hidden` container.
 */
const RowFrameWash: React.FC<RowFrameWashProps> = ({ image, className = '' }) => {
    if (!image) return null;
    const { scale, position, opacity } = FRAMING[image.kind];

    return (
        <div
            className={`pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] ${className}`}
            aria-hidden="true"
        >
            <img
                src={image.url}
                alt=""
                loading="lazy"
                decoding="async"
                className={`absolute inset-y-0 right-0 h-full w-3/5 object-cover transition-opacity duration-300 ${opacity}`}
                style={{
                    objectPosition: position,
                    transform: `scale(${scale})`,
                    // A mask rather than a gradient overlay, for the reason given
                    // in HeroCollageBackground: these rows have no fill of their
                    // own, so paint on top would be a shade the page never uses.
                    WebkitMaskImage:
                        'linear-gradient(to left, rgba(0,0,0,1) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0) 100%)',
                    maskImage:
                        'linear-gradient(to left, rgba(0,0,0,1) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0) 100%)',
                }}
                // A member's own link, and a poster URL from a film nobody
                // vetted, both go dead without warning. Hiding the element is
                // enough — the row is designed to look right without it.
                onError={(event) => {
                    event.currentTarget.style.display = 'none';
                }}
            />
        </div>
    );
};

export default RowFrameWash;
