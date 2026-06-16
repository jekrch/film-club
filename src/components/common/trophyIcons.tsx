import type { JSX } from 'react';
import { TrophyIcon } from '@heroicons/react/24/outline';
import { TrophyIcon as TrophyIconSolid } from '@heroicons/react/24/solid';

type IconProps = { className?: string };

// A large, faded trophy silhouette for seating behind a card/panel.
// Bleeds off the corner and gradient-masks toward the content so text stays legible.
// Pass position/size utilities via `className`; the host element must be `relative overflow-hidden`.
export const TrophyWatermark = ({ className = '' }: IconProps) => (
    <TrophyIconSolid
        aria-hidden="true"
        className={`pointer-events-none absolute select-none text-amber-400/[0.06] [mask-image:linear-gradient(to_left,black,transparent_80%)] ${className}`}
    />
);

const svgBase = {
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
};

// "Bad Boy" — sunglasses, naturally
export const SunglassesIcon = ({ className }: IconProps) => (
    <svg className={className} {...svgBase}>
        <circle cx="6.5" cy="13.5" r="3.75" />
        <circle cx="17.5" cy="13.5" r="3.75" />
        <path d="M10.25 12.5c.9-.9 2.6-.9 3.5 0" />
        <path d="M2.75 10.5 4.5 8.5M21.25 10.5 19.5 8.5" />
    </svg>
);

// "Togetherness" — two souls, overlapping
export const TogethernessIcon = ({ className }: IconProps) => (
    <svg className={className} {...svgBase}>
        <circle cx="9" cy="12" r="5.5" />
        <circle cx="15" cy="12" r="5.5" />
    </svg>
);

// "Reframer" — viewfinder corners
export const ReframeIcon = ({ className }: IconProps) => (
    <svg className={className} {...svgBase}>
        <path d="M4 8.5V6a2 2 0 0 1 2-2h2.5" />
        <path d="M15.5 4H18a2 2 0 0 1 2 2v2.5" />
        <path d="M20 15.5V18a2 2 0 0 1-2 2h-2.5" />
        <path d="M8.5 20H6a2 2 0 0 1-2-2v-2.5" />
    </svg>
);

// "Helmet" — a hard hat
export const HelmetIcon = ({ className }: IconProps) => (
    <svg className={className} {...svgBase}>
        <path d="M3.5 16.5h17" />
        <path d="M5.5 16.5a6.5 6.5 0 0 1 13 0" />
        <path d="M10 10.2V7.5A1.5 1.5 0 0 1 11.5 6h1A1.5 1.5 0 0 1 14 7.5v2.7" />
    </svg>
);

// "In sickness and in health" — a heart with a pulse running through it
export const HeartPulseIcon = ({ className }: IconProps) => (
    <svg className={className} {...svgBase}>
        <path d="M12 20.5C12 20.5 4 16 4 10.5A4 4 0 0 1 12 8a4 4 0 0 1 8 2.5C20 16 12 20.5 12 20.5Z" />
        <path d="M6.5 11.5h2.5l1-2 1.5 4 1-2h3" />
    </svg>
);

// "Special Connection" — sparkles
export const SparklesIcon = ({ className }: IconProps) => (
    <svg className={className} {...svgBase}>
        <path d="M12 3.5 13.4 8.1 18 9.5 13.4 10.9 12 15.5 10.6 10.9 6 9.5 10.6 8.1 12 3.5Z" />
        <path d="M18.5 14.5 19.2 16.8 21.5 17.5 19.2 18.2 18.5 20.5 17.8 18.2 15.5 17.5 17.8 16.8 18.5 14.5Z" />
    </svg>
);

export type IconComponent = (props: IconProps) => JSX.Element;

// Keyword → emblem. Earliest-appearing keyword wins so combined awards
// ("both togetherness and bad boy") pick the one mentioned first.
const ICON_MAP: { keywords: string[]; Icon: IconComponent }[] = [
    { keywords: ['bad boy'], Icon: SunglassesIcon },
    { keywords: ['reframer', 'reframe'], Icon: ReframeIcon },
    { keywords: ['helmet'], Icon: HelmetIcon },
    { keywords: ['sickness', 'health'], Icon: HeartPulseIcon },
    { keywords: ['special connection', 'connection'], Icon: SparklesIcon },
    { keywords: ['togetherness'], Icon: TogethernessIcon },
];

export const resolveTrophyIcon = (text: string): IconComponent => {
    const lower = text.toLowerCase();
    let bestIndex = Infinity;
    let bestIcon: IconComponent = TrophyIcon as IconComponent;

    ICON_MAP.forEach(({ keywords, Icon }) => {
        keywords.forEach(kw => {
            const i = lower.indexOf(kw);
            if (i !== -1 && i < bestIndex) {
                bestIndex = i;
                bestIcon = Icon;
            }
        });
    });

    return bestIcon;
};
