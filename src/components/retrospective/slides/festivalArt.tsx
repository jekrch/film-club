import React, { useId } from 'react';
import { resolveTrophyIcon } from '../../common/trophyIcons';

/**
 * Film-festival dressing for the trophy slides: the laurel branches that frame
 * an "official selection", and a gilded palm frond of the kind a festival hands
 * its top prize in. Drawn here from a little geometry rather than traced from
 * anyone's mark, so they read as "festival" without being any one festival's.
 */

/** Gold leaf, running warm into the deck's copper at the shadowed end. */
const GOLD_STOPS = [
    { offset: '0%', color: '#f6e3a1' },
    { offset: '45%', color: '#d9a534' },
    { offset: '100%', color: '#b76e41' },
];

const GoldGradient: React.FC<{ id: string; x1: string; y1: string; x2: string; y2: string }> = ({
    id,
    ...line
}) => (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" {...line}>
        {GOLD_STOPS.map((stop) => (
            <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
        ))}
    </linearGradient>
);

const round = (n: number): number => Math.round(n * 100) / 100;

/** A pointed leaf from `base` to `tip`, `width` across at its widest. */
const leafPath = (base: [number, number], tip: [number, number], width: number): string => {
    const [bx, by] = base;
    const [tx, ty] = tip;
    const mx = (bx + tx) / 2;
    const my = (by + ty) / 2;
    const len = Math.hypot(tx - bx, ty - by) || 1;
    // Unit normal to the leaf's spine.
    const nx = -(ty - by) / len;
    const ny = (tx - bx) / len;
    const a = [round(mx + nx * width), round(my + ny * width)];
    const b = [round(mx - nx * width), round(my - ny * width)];
    return `M${round(bx)} ${round(by)}Q${a[0]} ${a[1]} ${round(tx)} ${round(ty)}Q${b[0]} ${b[1]} ${round(bx)} ${round(by)}Z`;
};

/*
 * The laurel: a stem bowed along an arc, paired leaves along it pointing up
 * towards the tip, smaller as they climb. Laid out once, as the left branch;
 * the right is the same branch mirrored.
 */
const LAUREL_CX = 62;
const LAUREL_CY = 50;
const LAUREL_R = 44;
const LAUREL_FROM = (102 * Math.PI) / 180; // the stem's foot, low on the left
const LAUREL_TO = (250 * Math.PI) / 180; // its tip, high on the left
const LAUREL_LEAVES_PER_SIDE = 13;

const onArc = (theta: number): [number, number] => [
    LAUREL_CX + LAUREL_R * Math.cos(theta),
    LAUREL_CY + LAUREL_R * Math.sin(theta),
];

const LAUREL_STEM = (() => {
    const [x0, y0] = onArc(LAUREL_FROM);
    const [x1, y1] = onArc(LAUREL_TO);
    return `M${round(x0)} ${round(y0)}A${LAUREL_R} ${LAUREL_R} 0 0 1 ${round(x1)} ${round(y1)}`;
})();

/** One leaf off the stem at `t` (0 foot, 1 tip), on the outer (1) or inner (-1) side. */
const laurelLeaf = (t: number, side: 1 | -1): string => {
    const theta = LAUREL_FROM + (LAUREL_TO - LAUREL_FROM) * t;
    const [px, py] = onArc(theta);
    // Up the stem, and out from (or in towards) the arc's centre.
    const tangent: [number, number] = [-Math.sin(theta), Math.cos(theta)];
    const outward: [number, number] = [Math.cos(theta), Math.sin(theta)];
    // Inner leaves lie closer to the stem, so the wreath stays open in the middle.
    const spread = side > 0 ? 0.62 : 0.42;
    const dx = tangent[0] + outward[0] * spread * side;
    const dy = tangent[1] + outward[1] * spread * side;
    const len = Math.hypot(dx, dy);
    // Fullest a little above the foot, tapering to the tip.
    const size = (side > 0 ? 12 : 9.5) * (1 - 0.45 * t) * Math.min(1, 0.7 + t * 2);
    const tip: [number, number] = [px + (dx / len) * size, py + (dy / len) * size];
    return leafPath([px, py], tip, size * 0.25);
};

const LAUREL_LEAVES: string[] = (() => {
    const leaves: string[] = [];
    for (let i = 0; i < LAUREL_LEAVES_PER_SIDE; i++) {
        // Outer and inner leaves alternate up the stem rather than pairing off.
        leaves.push(laurelLeaf((i + 0.3) / LAUREL_LEAVES_PER_SIDE, 1));
        if (i < LAUREL_LEAVES_PER_SIDE - 1) {
            leaves.push(laurelLeaf((i + 0.8) / LAUREL_LEAVES_PER_SIDE, -1));
        }
    }
    // One last leaf to finish the tip.
    const [tx, ty] = onArc(LAUREL_TO);
    const up: [number, number] = [-Math.sin(LAUREL_TO), Math.cos(LAUREL_TO)];
    leaves.push(leafPath([tx, ty], [tx + up[0] * 7, ty + up[1] * 7], 1.3));
    return leaves;
})();

/**
 * One laurel branch, the left of a pair; `flip` for the right. Size it by
 * height (it is half as wide as it is tall).
 */
export const Laurel: React.FC<{ flip?: boolean; className?: string }> = ({
    flip = false,
    className = '',
}) => {
    const gradient = useId();
    return (
        <svg
            viewBox="11 4 45 93"
            aria-hidden="true"
            className={`shrink-0 ${flip ? '-scale-x-100' : ''} ${className}`}
        >
            <defs>
                <GoldGradient id={gradient} x1="30" y1="2" x2="30" y2="98" />
            </defs>
            <path
                d={LAUREL_STEM}
                fill="none"
                stroke={`url(#${gradient})`}
                strokeWidth="0.9"
                strokeLinecap="round"
            />
            <g fill={`url(#${gradient})`}>
                {LAUREL_LEAVES.map((d) => (
                    <path key={d} d={d} />
                ))}
            </g>
        </svg>
    );
};

/*
 * The palm frond: a rib curving from its stalk up to a tip, with slender
 * leaflets off both sides, longest at the middle and drawn back towards the
 * tip, the way a palm leaf lies.
 */
const RIB: [number, number][] = [
    [26, 192],
    [42, 70],
    [168, 18],
];

const ribAt = (t: number): { point: [number, number]; tangent: [number, number] } => {
    const [p0, p1, p2] = RIB;
    const u = 1 - t;
    const point: [number, number] = [
        u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
        u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
    ];
    const dx = 2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
    const dy = 2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
    const len = Math.hypot(dx, dy) || 1;
    return { point, tangent: [dx / len, dy / len] };
};

const FROND_RIB = `M${RIB[0].join(' ')}Q${RIB[1].join(' ')} ${RIB[2].join(' ')}`;

const FROND_LEAFLETS: string[] = (() => {
    const leaflets: string[] = [];
    const count = 24;
    for (let i = 0; i < count; i++) {
        // The stalk is bare for its first stretch.
        const t = 0.2 + (0.78 * i) / (count - 1);
        const { point, tangent } = ribAt(t);
        const normal: [number, number] = [-tangent[1], tangent[0]];
        const reach = 54 * Math.pow(Math.sin(Math.PI * Math.min(1, (t - 0.12) / 0.92)), 0.7) + 6;
        ([1, -1] as const).forEach((side) => {
            // Swept back towards the tip at about forty degrees.
            const dx = tangent[0] * 0.78 + normal[0] * 0.62 * side;
            const dy = tangent[1] * 0.78 + normal[1] * 0.62 * side;
            const len = Math.hypot(dx, dy);
            const tip: [number, number] = [
                point[0] + (dx / len) * reach,
                point[1] + (dy / len) * reach,
            ];
            leaflets.push(leafPath(point, tip, 1.9));
        });
    }
    return leaflets;
})();

/**
 * A gilded palm frond, large and faint, for lying behind a slide. The host
 * positions it with `className`; it fades off at its stalk so it never ends
 * in a hard edge.
 */
export const PalmFrond: React.FC<{ className?: string }> = ({ className = '' }) => {
    const gradient = useId();
    return (
        <svg
            viewBox="0 0 200 200"
            aria-hidden="true"
            className={`pointer-events-none select-none overflow-visible [mask-image:linear-gradient(to_top_right,transparent_8%,black_45%)] ${className}`}
        >
            <defs>
                <GoldGradient id={gradient} x1="170" y1="10" x2="20" y2="190" />
            </defs>
            <path
                d={FROND_RIB}
                fill="none"
                stroke={`url(#${gradient})`}
                strokeWidth="1.6"
                strokeLinecap="round"
            />
            <g fill={`url(#${gradient})`}>
                {FROND_LEAFLETS.map((d) => (
                    <path key={d} d={d} />
                ))}
            </g>
        </svg>
    );
};

/** The gold the festival dressing is gilded in, for the marks that sit beside it. */
export const GILT = '#e3c172';

/**
 * An award's emblem, engraved rather than struck: a hairline gilt ring with the
 * emblem drawn in the same gold, nothing filled, so it sits with the laurels.
 */
export const Emblem: React.FC<{ award: string }> = ({ award }) => {
    const Icon = resolveTrophyIcon(award);
    return (
        <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10"
            style={{ color: GILT, boxShadow: `inset 0 0 0 1px ${GILT}80` }}
        >
            <Icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
        </span>
    );
};

/**
 * A count of trophies in its laurel wreath, like a festival's official
 * selection, with "trophies won" beside it as the deck sets every headline
 * figure.
 */
export const WreathedCount: React.FC<{ count: number }> = ({ count }) => (
    <div className="mt-3 flex items-center gap-3 sm:gap-5">
        <div className="flex shrink-0 items-center">
            <Laurel className="h-24 w-auto sm:h-36" />
            <p className="-mx-0.5 font-figures lining-nums text-[4.5rem] leading-none text-slate-50 sm:-mx-1 sm:text-[6.5rem]">
                {count}
            </p>
            <Laurel flip className="h-24 w-auto sm:h-36" />
        </div>
        <p className="max-w-[9em] font-serif text-2xl leading-tight text-slate-200 sm:text-3xl">
            {count === 1 ? 'trophy won' : 'trophies won'}
        </p>
    </div>
);
