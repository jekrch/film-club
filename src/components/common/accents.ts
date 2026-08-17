/**
 * Semantic accent colors. Keep these meaningful rather than decorative:
 * emerald = member voice / reviews, blue = stats & facts, rose = divergence,
 * amber = awards and qualifiers.
 */
export type CardAccent = 'emerald' | 'blue' | 'amber' | 'rose';

/**
 * The accent rail: a flat tint down a surface's left edge, worn by both
 * AccentCard and Modal — a dialog is another surface in this system, and the
 * two must never drift to different tints.
 *
 * Tailwind can't see dynamically built class names, so this is a static map.
 * Flat rather than a vertical fade: a fade reaches transparent at a rate set by
 * the surface's height, so tall and short cards ended up with visibly different
 * rails.
 *
 * Lives here rather than in AccentCard so neither component file has to carry a
 * non-component value export, which is all it takes to break fast refresh for
 * the whole module.
 */
export const ACCENT_RAIL: Record<CardAccent, string> = {
    emerald: 'bg-emerald-400/50',
    blue: 'bg-blue-400/50',
    amber: 'bg-amber-400/50',
    rose: 'bg-rose-400/50',
};
