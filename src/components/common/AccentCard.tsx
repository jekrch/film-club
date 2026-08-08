import classNames from 'classnames';
import React from 'react';

/**
 * Semantic accent colors. Keep these meaningful rather than decorative:
 * emerald = member voice / reviews, blue = stats & facts, rose = divergence,
 * amber = awards and qualifiers.
 */
export type CardAccent = 'emerald' | 'blue' | 'amber' | 'rose';

// Tailwind can't see dynamically built class names, so accents are static maps.
// The rail is a flat tint rather than a vertical fade — a fade reaches
// transparent at a rate set by card height, so tall and short cards ended up
// with visibly different rails.
const RAIL: Record<CardAccent, string> = {
  emerald: 'bg-emerald-400/50',
  blue: 'bg-blue-400/50',
  amber: 'bg-amber-400/50',
  rose: 'bg-rose-400/50',
};

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
  // by its border and rail rather than by a panel of color. This is deliberate
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
   * The accent rail down the left edge. Disable for repeating grid items — a
   * wall of rails reads as noise rather than emphasis.
   */
  rail?: boolean;
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
 * an accent rail, and an optional masked watermark. Padding is left to the
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
  rail = true,
  surface = 'card',
  className,
  contentClassName,
}) => (
  <div
    className={classNames(
      'group/card relative rounded-xl border transition-colors duration-300',
      SURFACE[surface],
      HOVER_BORDER[accent],
      className,
    )}
  >
    {/* Decoration layer: clips the watermark and squares-off the rail against
        the card's rounded corners, without clipping the card's own children.
        `rounded-[inherit]` tracks any radius a caller overrides. */}
    {(watermarkSrc || rail) && (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
      >
        {watermarkSrc && (
          <img
            src={watermarkSrc}
            alt=""
            className="absolute inset-y-0 right-0 h-full w-2/5 object-cover object-top opacity-[0.11] grayscale transition-opacity duration-300 group-hover/card:opacity-[0.18]"
            style={{
              WebkitMaskImage: 'linear-gradient(to right, transparent, black)',
              maskImage: 'linear-gradient(to right, transparent, black)',
            }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        )}
        {rail && (
          <span className={classNames('absolute inset-y-0 left-0 w-0.5', RAIL[accent])} />
        )}
      </div>
    )}
    <div className={classNames('relative z-10', contentClassName)}>{children}</div>
  </div>
);

export default AccentCard;
