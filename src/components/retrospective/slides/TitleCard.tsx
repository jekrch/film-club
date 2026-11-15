import React from 'react';
import CircularImage from '../../common/CircularImage';
import Slide, { Eyebrow, Reveal } from '../Slide';

interface TitleCardProps {
    eyebrow: string;
    title: string;
    subtitle?: string;
    accent: string;
    /** Stills for the reel across the top. */
    reel?: string[];
    /** A member's report opens on their face. */
    avatar?: { src: string; name: string };
}

/** The deck's first slide. The deck shows the year's art strongest behind it. */
const TitleCard: React.FC<TitleCardProps> = ({
    eyebrow,
    title,
    subtitle,
    accent,
    reel,
    avatar,
}) => (
    <Slide reel={reel} className="text-center">
        {avatar && (
            <Reveal>
                <div
                    className="mx-auto mb-6 w-fit rounded-full p-1"
                    style={{ boxShadow: `0 0 0 2px ${accent}` }}
                >
                    <CircularImage
                        src={avatar.src}
                        alt={avatar.name}
                        size="w-24 h-24 sm:w-28 sm:h-28"
                    />
                </div>
            </Reveal>
        )}
        <Reveal step={avatar ? 1 : 0}>
            <Eyebrow color={accent}>{eyebrow}</Eyebrow>
        </Reveal>
        <Reveal step={avatar ? 2 : 1}>
            <h1 className="mt-4 font-serif text-6xl leading-none text-slate-50 sm:text-8xl">
                {title}
            </h1>
        </Reveal>
        {subtitle && (
            <Reveal step={avatar ? 3 : 2}>
                <p className="mt-6 font-serif text-xl italic text-slate-300 sm:text-2xl">
                    {subtitle}
                </p>
            </Reveal>
        )}
    </Slide>
);

export default TitleCard;
