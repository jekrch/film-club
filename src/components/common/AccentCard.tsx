import classNames from 'classnames';
import React from 'react';
import { ACCENT_EDGE, ACCENT_EDGE_BASE, type CardAccent } from './accents';

// The accent set and the edge live in `accents.ts`, shared with Modal. Re-
// exported here because every call site already reaches for the type through
// this module.
export type { CardAccent };

// Tailwind can't see dynamically built class names, so accents are static maps.
const HOVER_BORDER: Record<CardAccent, string> = {
    emerald: 'hover:border-emerald-400/30',
    blue: 'hover:border-blue-400/30',
    amber: 'hover:border-amber-400/30',
    rose: 'hover:border-rose-400/30',
};

/**
 * Two levels of surface. `card` is the opaque page-level card; `inset` is for
 * cards nested inside one, which must differ from their container to read as
 * separate. Nothing else should invent a third shade.
 */
export type CardSurface = 'card' | 'inset';

const SURFACE: Record<CardSurface, string> = {
    // No fill: the page background reads straight through, so a card is defined
    // by its border and edge rather than by a panel of color. This is deliberate
    // — do not add a background here.
    card: 'border-slate-700/60 shadow-sm shadow-black/30',
    inset: 'bg-slate-700/25 border-slate-600/30',
};

interface AccentCardProps {
    children: React.ReactNode;
    accent?: CardAccent;
    /**
     * Optional image washed in from the right at low opacity and masked so it
     * dissolves toward the text. Use the subject of the card (a reviewer's
     * portrait, a film poster).
     */
    watermarkSrc?: string;
    /**
     * Background art rendered in the card's decoration layer — spanning the whole
     * card and clipped to its corners, rather than sitting inside the padding box
     * the way a child would. The layer is inert, so anything interactive in here
     * has to opt back in with `pointer-events-auto` (see FilmFrameWash).
     */
    decoration?: React.ReactNode;
    /**
     * The accent-lit hairline along the top edge. Disable for repeating grid
     * items — a wall of them reads as noise rather than emphasis.
     */
    edge?: boolean;
    /** Page-level card, or a card nested inside another one. */
    surface?: CardSurface;
    className?: string;
    /**
     * Classes for the inner content wrapper. Needed when the layout must apply to
     * the children themselves (e.g. `flex justify-between`), since they sit one
     * level below the card's outer element.
     */
    contentClassName?: string;
}

/**
 * Shared card shell: flat body, soft border that warms to the accent on hover,
 * an accent-lit top edge, and an optional masked watermark. Padding is left to the
 * caller via className.
 *
 * The card root is deliberately NOT `overflow-hidden`: that would trap any
 * popover a child renders (dropdown panels, tooltips) inside the card. The
 * decorations that do need clipping get their own inset layer instead.
 */
const AccentCard: React.FC<AccentCardProps> = ({
    children,
    accent = 'blue',
    watermarkSrc,
    decoration,
    edge = true,
    surface = 'card',
    className,
    contentClassName,
}) => (
    <div
        className={classNames(
            'group/card relative rounded-xl border transition-colors duration-300',
            SURFACE[surface],
            HOVER_BORDER[accent],
            className
        )}
    >
        {/* Decoration layer: clips the watermark, the `decoration` slot, and the
        edge against the card's rounded corners, without clipping the card's own
        children. `rounded-[inherit]` tracks any radius a caller overrides.

        Not `aria-hidden`: the decoration slot can hold real content (a credit
        link naming the art). Everything else in here is already ignored — the
        watermark is `alt=""` and the edge is an empty span. */}
        {(watermarkSrc || decoration || edge) && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
                {decoration}
                {watermarkSrc && (
                    <img
                        src={watermarkSrc}
                        alt=""
                        className="absolute inset-y-0 right-0 h-full w-2/5 object-cover object-top opacity-[0.11] grayscale transition-opacity duration-300 group-hover/card:opacity-[0.18]"
                        style={{
                            WebkitMaskImage: 'linear-gradient(to right, transparent, black)',
                            maskImage: 'linear-gradient(to right, transparent, black)',
                        }}
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                        }}
                    />
                )}
                {edge && <span className={classNames(ACCENT_EDGE_BASE, ACCENT_EDGE[accent])} />}
            </div>
        )}
        <div className={classNames('relative z-10', contentClassName)}>{children}</div>
    </div>
);

export default AccentCard;
