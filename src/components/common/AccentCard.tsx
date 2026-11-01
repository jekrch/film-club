import classNames from 'classnames';
import React from 'react';
import type { CardAccent } from './accents';

// The accent set lives in `accents.ts`. Re-exported here because every call site
// already reaches for the type through this module.
export type { CardAccent };

// Tailwind can't see dynamically built class names, so accents are static maps.
const HOVER_BORDER: Record<CardAccent, string> = {
    neutral: 'hover:border-slate-400/30',
    blue: 'hover:border-blue-400/30',
    amber: 'hover:border-amber-400/30',
    rose: 'hover:border-rose-400/30',
};

/**
 * Boxes are for things you can use. `section` draws no box at all, and is what
 * anything you only read should be: spacing and its head's rule separate it. `card`
 * is for something clickable, and `inset` is for a form within a section.
 */
export type CardSurface = 'section' | 'card' | 'inset';

const BOX = 'rounded-xl border transition-colors duration-300';

const SURFACE: Record<CardSurface, string> = {
    section: '',
    // No fill: the page background reads straight through, so a card is defined
    // by its border rather than by a panel of color. This is deliberate — do not
    // add a background here.
    card: `${BOX} border-slate-700/60 shadow-sm shadow-black/30`,
    inset: `${BOX} bg-slate-700/25 border-slate-600/30`,
};

interface AccentCardProps {
    children: React.ReactNode;
    /** The border's color on hover. A `section` has no border to color. */
    accent?: CardAccent;
    /**
     * Background art rendered in the card's decoration layer — spanning the whole
     * card and clipped to its corners, rather than sitting inside the padding box
     * the way a child would. The layer is inert, so anything interactive in here
     * has to opt back in with `pointer-events-auto` (see FilmFrameWash).
     */
    decoration?: React.ReactNode;
    /** An unboxed section, a clickable card, or a form within a section. */
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
 * Shared section and card shell. A box has a flat body and a soft border that warms
 * to the accent on hover. Padding is left to the caller via className.
 *
 * The card root is deliberately NOT `overflow-hidden`: that would trap any
 * popover a child renders (dropdown panels, tooltips) inside the card. The
 * decorations that do need clipping get their own inset layer instead.
 */
const AccentCard: React.FC<AccentCardProps> = ({
    children,
    accent = 'blue',
    decoration,
    surface = 'section',
    className,
    contentClassName,
}) => (
    <div
        className={classNames(
            'group/card relative',
            SURFACE[surface],
            surface !== 'section' && HOVER_BORDER[accent],
            className
        )}
    >
        {/* Decoration layer: clips the `decoration` slot against the card's rounded
        corners, without clipping the card's own children. `rounded-[inherit]`
        tracks any radius a caller overrides.

        Not `aria-hidden`: the decoration slot can hold real content (a credit
        link naming the art). */}
        {decoration && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
                {decoration}
            </div>
        )}
        <div className={classNames('relative z-10', contentClassName)}>{children}</div>
    </div>
);

export default AccentCard;
