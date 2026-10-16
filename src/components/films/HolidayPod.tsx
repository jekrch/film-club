import React from 'react';
import type { Holiday } from '../../types/film';
import { RIBBON_FOLD_CLIP_LEFT, RIBBON_FOLD_CLIP_RIGHT } from './PopcornPod';

/**
 * "Holiday Pod" branding for the club's seasonal screenings (see
 * `Film.holidayPod`): a film watched together for a holiday, outside the
 * selection rotation, and scored like any other.
 *
 * Built from the same parts as the Popcorn Pod — a sash folded over the
 * poster's top-left corner, a poster treatment, a disclaimer on the detail
 * page, a chip on the wall — with every colour and ornament drawn from a
 * per-holiday theme. Only Halloween exists so far; another holiday is one more
 * entry in {@link HOLIDAY_THEMES} and one more member of `Holiday`.
 *
 * Tailwind only generates classes it can find written out in full, so each
 * theme spells its classes literally rather than composing them from a colour
 * name.
 */

interface HolidayTheme {
    /** The holiday's name as prose uses it: "our Halloween screening". */
    name: string;
    /** Poster filter, applied alongside the stamp. */
    posterFilter: string;
    /** An optional wash laid over the poster under the stamp. */
    posterWash?: string;
    /** The sash's band: gradient, hover gradient, border, lettering shadow. */
    band: string;
    /** The tucked-under tails at each end of the band. */
    tail: string;
    /** The film card's border, replacing the default hairline. */
    cardBorder: string;
    /** Disclaimer panel and its heading. */
    disclaimer: string;
    disclaimerText: string;
    disclaimerHeading: string;
    /** The wall's chip. */
    chip: string;
    /** "Upcoming" lettering on the card and detail page. */
    upcomingText: string;
    /** A small glyph for the chip and disclaimer, sized by font size. */
    Glyph: React.FC<{ className?: string }>;
    /** An ornament for the poster's top-right corner, opposite the sash. */
    Corner?: React.FC;
    /** An ornament for the bottom-right corner of the film card's detail bar. */
    BarCorner?: React.FC<{ className?: string }>;
}

// --- Halloween ---------------------------------------------------------------

/** A jack-o'-lantern, one `em` square, in `currentColor`. */
const JackOLantern: React.FC<{ className?: string }> = ({ className = '' }) => (
    <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={`inline-block h-[1em] w-[1em] ${className}`}
    >
        <path d="M12 6.2c-.3-1.6.2-3 1.6-3.9l.8 1.1c-.9.6-1.2 1.5-1 2.8z" fill="#65a30d" />
        <path
            fill="currentColor"
            d="M12 6.5c-1.4-.9-3.4-1.1-5.3-.4C3.9 7.2 2.5 10 2.5 13.3s1.6 6.1 4.4 7.1c1.9.7 3.7.4 5.1-.4 1.4.8 3.2 1.1 5.1.4 2.8-1 4.4-3.8 4.4-7.1s-1.4-6.1-4.2-7.2c-1.9-.7-3.9-.5-5.3.4z"
        />
        <path
            fill="#1c0b2e"
            d="M7 11.2l2.4-.3-1 2.2zM17 11.2l-2.4-.3 1 2.2zM12 13.4l1 1.6h-2zM6.6 15.8c1.1 1.6 3 2.4 5.4 2.4s4.3-.8 5.4-2.4l-1.6.4-.6 1-1.2-.9-2 .9-2-.9-1.2.9-.6-1z"
        />
    </svg>
);

/**
 * A cobweb strung across a corner at (100, 0) of a 100-unit box: spokes fanning
 * from the corner to the top and right edges, joined by threads that sag back
 * toward it. Computed once, since nothing about it varies.
 */
const COBWEB_PATH = (() => {
    const spokes = [0, 18, 36, 54, 72, 90].map((deg) => (deg * Math.PI) / 180);
    const at = (r: number, a: number) =>
        `${(100 - r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)}`;

    const parts = spokes.map((a) => `M100 0L${at(100, a)}`);
    for (const r of [24, 44, 64, 84]) {
        for (let i = 0; i < spokes.length - 1; i++) {
            const mid = (spokes[i] + spokes[i + 1]) / 2;
            parts.push(`M${at(r, spokes[i])}Q${at(r * 0.84, mid)} ${at(r, spokes[i + 1])}`);
        }
    }
    return parts.join('');
})();

/**
 * A cobweb in the poster's top-right corner, with a spider let down from it on
 * a thread. Sized in `cqw` against the stamp's container, like the sash, so it
 * holds its proportions on a grid card and on the detail page. The spider drops
 * a little further on hover, in step with the sash's swell.
 */
/**
 * The same cobweb without its spider, flipped into the bottom-right corner of
 * the film card's detail bar. Faint, since it sits behind text; its parent
 * sizes and positions it.
 */
const CobwebBarCorner: React.FC<{ className?: string }> = ({ className = '' }) => (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={className}>
        <path
            d={COBWEB_PATH}
            transform="matrix(1 0 0 -1 0 100)"
            fill="none"
            stroke="rgba(241,245,249,0.22)"
            strokeWidth="1.5"
            strokeLinecap="round"
        />
    </svg>
);

// Temporarily off: the poster carries only the sash for now, and a bare web
// sits in the card's detail bar instead (see `CobwebBarCorner`).
// const Cobweb: React.FC = () => (
//     <svg
//         viewBox="0 0 100 100"
//         aria-hidden="true"
//         className="absolute top-0 right-0 w-[34cqw] h-[34cqw] overflow-visible"
//     >
//         <path
//             d={COBWEB_PATH}
//             fill="none"
//             stroke="rgba(241,245,249,0.42)"
//             strokeWidth="1.1"
//             strokeLinecap="round"
//             style={{ filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.8))' }}
//         />
//         <g className="transition-transform duration-500 ease-out group-hover:translate-y-[10px]">
//             <line
//                 x1="64"
//                 y1="18"
//                 x2="64"
//                 y2="56"
//                 stroke="rgba(241,245,249,0.5)"
//                 strokeWidth="0.8"
//             />
//             <g stroke="#0f0518" strokeWidth="1.6" strokeLinecap="round" fill="none">
//                 <path d="M61.5 58l-5-3.5-1.5-4M61.5 60l-6-.5-2.5 2.5M61.5 62l-5 2.5-1 4M62.5 63.5l-3 4.5" />
//                 <path d="M66.5 58l5-3.5 1.5-4M66.5 60l6-.5 2.5 2.5M66.5 62l5 2.5 1 4M65.5 63.5l3 4.5" />
//             </g>
//             <ellipse cx="64" cy="61" rx="3.6" ry="4.4" fill="#0f0518" />
//             <circle cx="64" cy="56.2" r="2.3" fill="#0f0518" />
//             <circle cx="63.1" cy="55.9" r="0.55" fill="#f97316" />
//             <circle cx="64.9" cy="55.9" r="0.55" fill="#f97316" />
//         </g>
//     </svg>
// );

export const HOLIDAY_THEMES: Record<Holiday, HolidayTheme> = {
    halloween: {
        name: 'Halloween',
        // Drained and darkened rather than cheapened: dusk, not a stale lobby.
        posterFilter: 'saturate-[0.7] contrast-[1.1] brightness-[0.82] hue-rotate-[-8deg]',
        band: `
            bg-gradient-to-r from-orange-600/85 via-orange-500/85 to-orange-600/85
            group-hover:from-orange-500/90 group-hover:via-orange-400/90 group-hover:to-orange-500/90
            border-y border-purple-950/60
            [text-shadow:0_0.04em_0.12em_rgba(46,16,101,0.95)]
        `,
        tail: 'bg-purple-900/85',
        cardBorder: '!border-orange-500/40',
        disclaimer: 'border-orange-500/80 bg-purple-950/40',
        disclaimerText: 'text-orange-100/90',
        disclaimerHeading: 'text-orange-300',
        chip: 'bg-orange-400/[0.07] text-orange-400/80 ring-orange-400/25',
        upcomingText: 'text-orange-400/90',
        Glyph: JackOLantern,
        // Corner: Cobweb,
        BarCorner: CobwebBarCorner,
    },
};

/**
 * The theme for a holiday, or `undefined` for one this build doesn't know.
 * `films.json` is untyped, so a value with no theme yet is possible; the film
 * then goes unbranded rather than wearing another holiday's colours.
 */
export const getHolidayTheme = (holiday: string | undefined | null): HolidayTheme | undefined =>
    holiday ? HOLIDAY_THEMES[holiday as Holiday] : undefined;

/** Poster filter for a holiday pod, or '' for any other film. */
export const holidayPosterFilter = (holiday: string | undefined | null): string =>
    getHolidayTheme(holiday)?.posterFilter ?? '';

/**
 * The sash, folded around the poster's top-left corner, plus the theme's corner
 * ornament opposite it. Same geometry as {@link PopcornPodStamp} — see its
 * comment for why every dimension is in `cqw` — so the two pods read as
 * siblings. Requires a `group` on the poster container.
 */
export const HolidayPodStamp: React.FC<{ holiday: Holiday }> = ({ holiday }) => {
    const theme = getHolidayTheme(holiday);
    if (!theme) return null;
    const { Corner } = theme;

    return (
        <div
            className="@container absolute inset-0 z-20 overflow-hidden pointer-events-none"
            title={`A ${theme.name} Holiday Pod — a seasonal screening, not a club selection`}
        >
            {theme.posterWash && <div className={`absolute inset-0 ${theme.posterWash}`} />}
            {Corner && <Corner />}

            <div
                className="
                absolute w-[90cqw] left-[-22cqw] top-[17.8cqw] -rotate-45
                transition-[scale] duration-300 ease-out group-hover:scale-105
            "
            >
                <div
                    className={`absolute top-full left-0 w-[34%] h-[4.7cqw] ${theme.tail}`}
                    style={{ clipPath: RIBBON_FOLD_CLIP_LEFT }}
                />
                <div
                    className={`absolute top-full right-0 w-[34%] h-[4.7cqw] ${theme.tail}`}
                    style={{ clipPath: RIBBON_FOLD_CLIP_RIGHT }}
                />
                <div
                    className={`
                    relative text-center whitespace-nowrap leading-none
                    text-[6.5cqw] tracking-[0.06em] py-[0.3em]
                    font-black uppercase text-white
                    backdrop-blur-[2px] shadow-lg shadow-black/60
                    transition-all duration-300 ease-out group-hover:shadow-xl
                    ${theme.band}
                `}
                >
                    Holiday Pod
                </div>
            </div>
        </div>
    );
};

/**
 * The prose counterpart to the stamp, for the detail page, in the Popcorn Pod
 * disclaimer's voice. An upcoming pod says so, since it has no watch date to
 * show yet.
 */
export const HolidayPodDisclaimer: React.FC<{ holiday: Holiday; upcoming: boolean }> = ({
    holiday,
    upcoming,
}) => {
    const theme = getHolidayTheme(holiday);
    if (!theme) return null;
    const { Glyph } = theme;

    return (
        <div className={`mb-4 rounded-md border-l-4 px-4 py-3 ${theme.disclaimer}`}>
            <p className={`text-sm leading-relaxed ${theme.disclaimerText}`}>
                <span className={`font-bold uppercase tracking-wide ${theme.disclaimerHeading}`}>
                    <Glyph className="mr-1.5 -mt-0.5 align-middle" />
                    Holiday Pod:
                </span>{' '}
                this film is <em>not</em> criterion and nobody <em>selected</em> it. It's a{' '}
                {theme.name} flick, viewed outside our usual business, but still scored out of 9.
                {upcoming && <> We haven't met for it yet.</>}
            </p>
        </div>
    );
};

/** The wall's chip, beside the "Popcorn Pod" one it mirrors. */
export const HolidayPodChip: React.FC<{ holiday: Holiday }> = ({ holiday }) => {
    const theme = getHolidayTheme(holiday);
    if (!theme) return null;
    const { Glyph } = theme;

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] uppercase tracking-wider ring-1 ring-inset ${theme.chip}`}
        >
            <Glyph />
            Holiday Pod
        </span>
    );
};
