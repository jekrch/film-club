/**
 * Semantic accent colors. Keep these meaningful rather than decorative:
 * emerald = member voice / reviews, blue = stats & facts, rose = divergence,
 * amber = awards and qualifiers.
 */
export type CardAccent = 'emerald' | 'blue' | 'amber' | 'rose';

/**
 * The accent edge: a hairline of light along a surface's top edge, tinted with
 * its accent and fading out at both ends. Worn by AccentCard, Modal, and the
 * panels that borrow their surface — a dialog is another surface in this system,
 * and the two must never drift to different tints.
 *
 * Along the top and faded rather than down the left and flat: a solid bar meets
 * the rounded corners and gets bent by them into a fingernail, and it reads as
 * a painted-on tab rather than part of the surface. A fading hairline is gone
 * before it reaches a corner, so it never fights the radius, and it reads as
 * light catching a raised edge — the same device the Modal already used in white.
 *
 * Tailwind can't see dynamically built class names, so this is a static map;
 * pair it with {@link ACCENT_EDGE_BASE}.
 *
 * Lives here rather than in AccentCard so neither component file has to carry a
 * non-component value export, which is all it takes to break fast refresh for
 * the whole module.
 */
export const ACCENT_EDGE: Record<CardAccent, string> = {
    emerald: 'via-emerald-400/50',
    blue: 'via-blue-400/50',
    amber: 'via-amber-400/50',
    rose: 'via-rose-400/50',
};

/** Placement and gradient shared by every {@link ACCENT_EDGE}. */
export const ACCENT_EDGE_BASE =
    'pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent';
