import Highcharts from 'highcharts';

// The almanac's chart styling, shared by every Highcharts chart on the page.
//
// Chart type, matched to the profile page's: labels in small-caps sans, figures
// in serif. Highcharts draws to SVG and can't see Tailwind, so the slates the
// rest of the page uses are spelled out here.
export const SANS = 'Inter, sans-serif';
export const SERIF = 'Merriweather, serif';
export const SLATE_100 = '#f1f5f9';
export const SLATE_300 = '#cbd5e1';
export const SLATE_400 = '#94a3b8';
export const SLATE_500 = '#64748b';
export const SLATE_600 = '#475569';
// The page background (index.css). Slice borders in this color read as gaps.
export const PAGE_BG = '#0f172b';
// slate-600 at the opacity the stat cards' rules use.
export const RULE = 'rgba(71, 85, 105, 0.4)';
export const COPPER = '#b76e41';

export const SMALL_CAPS: Highcharts.CSSObject = {
    fontFamily: SANS,
    fontSize: '10px',
    fontWeight: '500',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: SLATE_400,
};
export const FIGURES: Highcharts.CSSObject = {
    fontFamily: SERIF,
    fontSize: '11px',
    color: SLATE_400,
};

export const escapeHtml = (text: string): string =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * A tooltip set like the stat cards: a small-caps label, the figure in serif,
 * and an optional serif-italic note (a film title).
 *
 * The whole card is drawn here in HTML rather than by Highcharts' SVG box (see
 * TOOLTIP_CARD), so it can have a real shadow, the modal's faint ring, and an
 * accent rail down its left edge — the rail the page's cards carry, here in the
 * hovered slice or line's own color so the tooltip reads as belonging to it.
 */
export const tooltipCard = (label: string, figure: string, accent: string, note?: string): string =>
    `<div style="position:relative;overflow:hidden;min-width:120px;padding:10px 14px 10px 16px;border-radius:8px;background:rgba(30,41,59,0.94);box-shadow:0 12px 28px -8px rgba(0,0,0,0.65),0 0 0 1px rgba(255,255,255,0.07);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)">` +
    `<span style="position:absolute;left:0;top:0;bottom:0;width:3px;background:${accent}"></span>` +
    `<div style="font-size:10px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:${SLATE_400}">${escapeHtml(label)}</div>` +
    `<div style="margin-top:4px;font-family:${SERIF};font-size:18px;line-height:1.1;color:${SLATE_100}">${figure}</div>` +
    (note
        ? `<div style="margin-top:4px;max-width:220px;white-space:normal;font-family:${SERIF};font-style:italic;font-size:12px;line-height:1.35;color:${SLATE_300}">${escapeHtml(note)}</div>`
        : '') +
    `</div>`;

/** A small-caps word under a serif figure's unit: "34 <FILMS>". */
export const unit = (text: string): string =>
    `<span style="margin-left:4px;font-family:${SANS};font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${SLATE_400}">${text}</span>`;

/** Highcharts' own box is switched off; `tooltipCard` draws the card. */
export const TOOLTIP_CARD: Highcharts.TooltipOptions = {
    useHTML: true,
    backgroundColor: 'transparent',
    borderWidth: 0,
    shadow: false,
    padding: 0,
    style: { fontFamily: SANS, color: SLATE_300 },
};

/**
 * The Tailwind 300 shades members are given in `club.json`, as hex: the rest of
 * the site sets them as class names, which an SVG chart can't read.
 */
const TAILWIND_300: Record<string, string> = {
    'red-300': '#fca5a5',
    'orange-300': '#fdba74',
    'amber-300': '#fcd34d',
    'yellow-300': '#fde047',
    'lime-300': '#bef264',
    'green-300': '#86efac',
    'emerald-300': '#6ee7b7',
    'teal-300': '#5eead4',
    'cyan-300': '#67e8f9',
    'sky-300': '#7dd3fc',
    'blue-300': '#93c5fd',
    'indigo-300': '#a5b4fc',
    'violet-300': '#c4b5fd',
    'purple-300': '#d8b4fe',
    'fuchsia-300': '#f0abfc',
    'pink-300': '#f9a8d4',
    'rose-300': '#fda4af',
};

/** For members with no color of their own, in the order they're needed. */
const MEMBER_FALLBACKS = ['#d9a534', COPPER, SLATE_300, '#a87c5f'];

/**
 * A member's line color: their own, or failing that the `fallbackIndex`th of a
 * few warm neutrals that sit apart from the members' pastels.
 */
export const memberChartColor = (color: string | undefined, fallbackIndex: number): string =>
    (color && TAILWIND_300[color]) || MEMBER_FALLBACKS[fallbackIndex % MEMBER_FALLBACKS.length];

/** The ends of the copper ramp scores are shaded along: a dim, barely warm brown up to bright copper. */
export const COPPER_DIM = '#4a3326';
export const COPPER_BRIGHT = '#e3a072';

const channels = (hex: string): number[] =>
    [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));

/**
 * The color `t` of the way along the copper ramp, 0 the dim end and 1 the
 * bright. For a chart that shades its own points rather than through a color
 * axis, so it reads the same as the calendar's.
 */
export const copperShade = (t: number): string => {
    const clamped = Math.min(1, Math.max(0, t));
    const low = channels(COPPER_DIM);
    const high = channels(COPPER_BRIGHT);
    return `#${low
        .map((channel, i) =>
            Math.round(channel + (high[i] - channel) * clamped)
                .toString(16)
                .padStart(2, '0')
        )
        .join('')}`;
};
