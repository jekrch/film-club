import React from 'react';
import { Link } from 'react-router-dom';
import CircularImage from '../../common/CircularImage';

interface PosterProps {
    src: string | null | undefined;
    title: string;
    /** A club film's page; omitted for a film with none. */
    to?: string;
    className?: string;
}

/** A one-sheet at 2:3, linking to its film. A film with no poster gets its title on a card. */
export const Poster: React.FC<PosterProps> = ({ src, title, to, className = 'w-24' }) => {
    const image =
        src && !src.includes('N/A') ? (
            <img
                src={src}
                alt={title}
                className="aspect-[2/3] w-full rounded-sm object-cover shadow-lg ring-1 ring-slate-100/10"
            />
        ) : (
            <div className="flex aspect-[2/3] w-full items-center justify-center rounded-sm bg-slate-800 p-2 text-center font-serif text-sm text-slate-300 ring-1 ring-slate-100/10">
                {title}
            </div>
        );
    return (
        <div className={`shrink-0 ${className}`}>
            {to ? (
                <Link to={to} className="block transition-transform hover:scale-[1.03]">
                    {image}
                </Link>
            ) : (
                image
            )}
        </div>
    );
};

interface FilmStripProps {
    stills: string[];
    /** How many frames to show. */
    count?: number;
    className?: string;
}

/**
 * A few of a film's stills in a row, like frames cut from a reel: the strip of
 * dark sprocket margin above and below is what says "film" rather than
 * "thumbnails". Renders nothing for a film with no stills.
 */
export const FilmStrip: React.FC<FilmStripProps> = ({ stills, count = 3, className = '' }) => {
    const frames = stills.filter((url) => url && !url.includes('N/A')).slice(0, count);
    if (!frames.length) return null;
    return (
        <div
            className={`flex gap-1 rounded-sm bg-slate-950/80 px-1 py-2 shadow-lg ring-1 ring-slate-100/10 [background-image:repeating-linear-gradient(90deg,rgba(242,245,248,0.18)_0_4px,transparent_4px_10px)] [background-position:0_2px,0_calc(100%-2px)] [background-repeat:repeat-x] [background-size:100%_3px] ${className}`}
            aria-hidden="true"
        >
            {frames.map((url) => (
                <img
                    key={url}
                    src={url}
                    alt=""
                    loading="lazy"
                    className="aspect-video min-w-0 flex-1 rounded-[1px] object-cover"
                />
            ))}
        </div>
    );
};

interface ScoreLineProps {
    /** Each score with the colour of whoever gave it. */
    marks: { label: string; score: number; color: string; emphasis?: boolean }[];
    /** The top of the scale. */
    max?: number;
}

/**
 * Scores as dots on a line from nothing to nine, each in its giver's colour and
 * named underneath — so a spread reads as a distance, not as a table of
 * numbers. Dots that land on the same score stack.
 */
export const ScoreLine: React.FC<ScoreLineProps> = ({ marks, max = 9 }) => {
    const stacks = new Map<number, number>();
    return (
        <div className="relative mt-10 mb-16 h-px bg-slate-100/25">
            {Array.from({ length: max + 1 }, (_, n) => (
                <span
                    key={n}
                    className="absolute top-2 -translate-x-1/2 font-serif text-xs text-slate-500"
                    style={{ left: `${(n / max) * 100}%` }}
                >
                    {n}
                </span>
            ))}
            {marks.map((mark) => {
                const level = stacks.get(mark.score) ?? 0;
                stacks.set(mark.score, level + 1);
                return (
                    <div
                        key={mark.label}
                        className="absolute flex -translate-x-1/2 flex-col items-center"
                        style={{
                            left: `${(Math.min(max, Math.max(0, mark.score)) / max) * 100}%`,
                            bottom: `${-7 + level * 26}px`,
                        }}
                    >
                        <span
                            className="whitespace-nowrap text-[11px] font-semibold leading-none"
                            style={{ color: mark.color }}
                        >
                            {mark.label}
                        </span>
                        <span
                            className={`mt-1 block rounded-full ring-2 ring-page ${
                                mark.emphasis ? 'h-4 w-4' : 'h-3.5 w-3.5'
                            }`}
                            style={{ backgroundColor: mark.color }}
                        />
                    </div>
                );
            })}
        </div>
    );
};

interface PullQuoteProps {
    text: string;
    member: string;
    memberColor: string;
    title: string;
}

/** A review set large, with who wrote it and what about. */
export const PullQuote: React.FC<PullQuoteProps> = ({ text, member, memberColor, title }) => (
    <figure>
        <blockquote className="font-serif text-2xl leading-snug text-slate-50 sm:text-4xl">
            <span className="mr-1 text-5xl leading-none text-slate-500">“</span>
            {text}
        </blockquote>
        <figcaption className="mt-5 text-sm text-slate-400 sm:text-base">
            <span className="font-semibold" style={{ color: memberColor }}>
                {member}
            </span>
            , on <span className="font-serif italic text-slate-300">{title}</span>
        </figcaption>
    </figure>
);

/** A face, or the person's initial on a disc when TMDb has none. */
export const Headshot: React.FC<{
    src: string | null;
    name: string;
    accent: string;
    size: string;
}> = ({ src, name, accent, size }) =>
    src ? (
        <img
            src={src}
            alt={name}
            className={`${size} shrink-0 rounded-full object-cover`}
            style={{ boxShadow: `0 0 0 2px ${accent}` }}
        />
    ) : (
        <span
            className={`${size} flex shrink-0 items-center justify-center rounded-full bg-slate-800 font-serif text-2xl text-slate-300`}
            style={{ boxShadow: `0 0 0 2px ${accent}` }}
            aria-hidden="true"
        >
            {name.charAt(0)}
        </span>
    );

/** A member's photo in a ring of their colour. */
export const MemberFace: React.FC<{
    name: string;
    color?: string;
    /** The photo's size; the ring sits outside it. */
    size: string;
    className?: string;
}> = ({ name, color, size, className = '' }) => (
    <span
        className={`block shrink-0 rounded-full p-0.5 ${className}`}
        style={color ? { boxShadow: `0 0 0 2px ${color}` } : undefined}
        title={name}
    >
        <CircularImage alt={name} size={size} className="!border-0" />
    </span>
);

/** Several members' faces, overlapping, in the order given. */
export const FaceStack: React.FC<{
    faces: { name: string; color?: string }[];
    size: string;
    className?: string;
}> = ({ faces, size, className = '' }) => (
    <span className={`flex -space-x-2 ${className}`}>
        {faces.map((face) => (
            <MemberFace
                key={face.name}
                name={face.name}
                color={face.color}
                size={size}
                className="bg-page"
            />
        ))}
    </span>
);
