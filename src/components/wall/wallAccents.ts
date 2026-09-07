import type { CardAccent } from '../common/accents';
import type { WallEventKind } from '../../utils/wallUtils';

/**
 * What each kind of wall event is drawn in.
 *
 * These are the site's existing semantics, applied rather than invented (see
 * `common/accents.ts`): blue is club fact, so a screening is blue; emerald is a
 * member's own voice, so a film they logged — which carries their score and
 * their review and nobody else's — is emerald; amber is awards and curation, so
 * a trophy and a list are both amber. That last pair sharing a color is
 * deliberate. A fifth tint would say the two are as different from each other as
 * either is from a screening, and they aren't; their icons and their verbs are
 * what tell them apart.
 *
 * Lives apart from the components for the reason `accents.ts` does: a
 * non-component value export in a component module breaks fast refresh for the
 * whole file.
 */
export const KIND_ACCENT: Record<WallEventKind, CardAccent> = {
    'club-watch': 'blue',
    log: 'emerald',
    list: 'amber',
    trophy: 'amber',
};

/**
 * The timeline node: a hairline ring around a faint wash of the accent, which is
 * the same recipe the score and "club film" badges use elsewhere. Tailwind can't
 * see a class name it didn't find in the source, so these are static maps.
 */
export const NODE_CLASS: Record<CardAccent, string> = {
    emerald: 'ring-emerald-400/25 bg-emerald-400/[0.07] text-emerald-400/80',
    blue: 'ring-blue-400/25 bg-blue-400/[0.07] text-blue-400/80',
    amber: 'ring-amber-400/25 bg-amber-400/[0.07] text-amber-400/80',
    rose: 'ring-rose-400/25 bg-rose-400/[0.07] text-rose-400/80',
};

/**
 * The node when a member's own face fills it rather than an icon — which is what
 * a log's node holds, since the most specific thing about a log is whose it is.
 *
 * No fill and no text color, because the photograph is the fill. The ring is a
 * step stronger than {@link NODE_CLASS}'s: there it draws an edge around a wash
 * of itself, and here it has to hold one around a picture.
 */
export const NODE_PHOTO_CLASS: Record<CardAccent, string> = {
    emerald: 'ring-emerald-400/40 hover:ring-emerald-400/80',
    blue: 'ring-blue-400/40 hover:ring-blue-400/80',
    amber: 'ring-amber-400/40 hover:ring-amber-400/80',
    rose: 'ring-rose-400/40 hover:ring-rose-400/80',
};

/**
 * The club's own screening, drawn a step above the rows around it.
 *
 * A club pick is the wall's one *event of the club* — the night everybody was
 * at, and the thing every log, trophy, and average nearby is downstream of.
 * Interleaved with a member's logs it was reading as one more row of four, so
 * it now carries at rest what the others only reach on hover: its blue edge and
 * a wash of the same blue in the fill. It is the accent the row already meant,
 * turned up, rather than a treatment of its own — the wall stays one page read
 * straight down, with a heavier beat every few rows.
 */
export const CLUB_PICK_ROW_CLASS =
    'border-blue-500/30 bg-blue-500/[0.05] hover:border-blue-400/45 hover:bg-blue-500/[0.09]';

/** The node under that emphasis: the same recipe as {@link NODE_CLASS}, lit. */
export const CLUB_PICK_NODE_CLASS = 'ring-blue-400/50 bg-blue-400/[0.15] text-blue-300';

/** The row's border warming to its accent on hover, as every card here does. */
export const ROW_HOVER_CLASS: Record<CardAccent, string> = {
    emerald: 'hover:border-emerald-500/25',
    blue: 'hover:border-blue-500/25',
    amber: 'hover:border-amber-500/25',
    rose: 'hover:border-rose-500/25',
};

/** The date caption picking up the accent as the row is hovered. */
export const DATE_HOVER_CLASS: Record<CardAccent, string> = {
    emerald: 'group-hover:text-emerald-300/80',
    blue: 'group-hover:text-blue-300/80',
    amber: 'group-hover:text-amber-300/80',
    rose: 'group-hover:text-rose-300/80',
};
