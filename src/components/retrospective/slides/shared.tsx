import React, { useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { give } from '../../../hooks/useSqueeze';
import { prefersReducedMotion } from '../../../utils/motion';
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

/** Room left between two labels side by side, in px. */
const LABEL_GAP = 6;
/** How far each stacked level sits above the one below, in px. */
const LEVEL_RISE = 26;

/**
 * A level for each mark, in the order given, so that no two marks on one
 * level touch: each takes the lowest level with room for it. Centres and
 * widths share a unit; with no widths, only marks at the same spot stack.
 */
const stackMarks = (centres: number[], widths: number[], gap: number): number[] => {
    const taken: { left: number; right: number }[][] = [];
    return centres.map((centre, i) => {
        const half = (widths[i] ?? 0) / 2 + gap / 2;
        const span = { left: centre - half, right: centre + half };
        let level = 0;
        while (taken[level]?.some((t) => span.left <= t.right && t.left <= span.right)) level++;
        (taken[level] = taken[level] ?? []).push(span);
        return level;
    });
};

/**
 * Scores as dots on a line from nothing to nine, each in its giver's colour and
 * named underneath — so a spread reads as a distance, not as a table of
 * numbers. Marks close enough for their names to collide stack, earlier marks
 * staying on the line.
 */
export const ScoreLine: React.FC<ScoreLineProps> = ({ marks, max = 9 }) => {
    const frame = useRef<HTMLDivElement>(null);
    const columns = useRef<(HTMLDivElement | null)[]>([]);
    // The line's width and each mark's, once laid out. Until then (first
    // paint, jsdom) only marks on the same score stack.
    const [measured, setMeasured] = useState<{ width: number; widths: number[] } | null>(null);

    // Callers pass a fresh array each render; what matters is what's on it.
    const shape = marks.map((m) => `${m.label}:${m.score}`).join('|');
    useLayoutEffect(() => {
        const line = frame.current;
        if (!line) return;
        // offsetWidth, not the bounding box: a slide's reveal scales it.
        const measure = () => {
            const next = {
                width: line.offsetWidth,
                widths: columns.current.map((c) => c?.offsetWidth ?? 0),
            };
            setMeasured((prev) =>
                prev &&
                prev.width === next.width &&
                prev.widths.length === next.widths.length &&
                prev.widths.every((w, i) => w === next.widths[i])
                    ? prev
                    : next
            );
        };
        measure();
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(measure);
        observer.observe(line);
        return () => observer.disconnect();
    }, [shape]);

    const fractions = marks.map((mark) => Math.min(max, Math.max(0, mark.score)) / max);
    const levels = measured?.width
        ? stackMarks(
              fractions.map((f) => f * measured.width),
              measured.widths,
              LABEL_GAP
          )
        : stackMarks(fractions, [], 0);
    const top = Math.max(0, ...levels);

    return (
        <div
            ref={frame}
            className="relative mb-16 h-px bg-slate-100/25"
            style={{ marginTop: 40 + top * LEVEL_RISE }}
        >
            {Array.from({ length: max + 1 }, (_, n) => (
                <span
                    key={n}
                    className="absolute top-2 -translate-x-1/2 font-serif text-xs text-slate-500"
                    style={{ left: `${(n / max) * 100}%` }}
                >
                    {n}
                </span>
            ))}
            {marks.map((mark, i) => (
                <div
                    key={mark.label}
                    ref={(el) => {
                        columns.current[i] = el;
                    }}
                    className="absolute flex -translate-x-1/2 flex-col items-center"
                    style={{
                        left: `${fractions[i] * 100}%`,
                        bottom: `${-7 + levels[i] * LEVEL_RISE}px`,
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
            ))}
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

/**
 * A figure in each year, a column a year, with one year in the accent. Each
 * column's height is its `scale`d value, 0 to 1; its label is `format`ted.
 */
export const YearColumns: React.FC<{
    label: string;
    columns: { year: number; value: number }[];
    year: number;
    format: (value: number) => string;
    scale: (value: number) => number;
    accent: string;
    delay: number;
    /** Taller columns, for a slide where the chart is the point. */
    tall?: boolean;
}> = ({ label, columns, year, format, scale, accent, delay, tall = false }) => {
    const still = prefersReducedMotion();
    const summary = columns.map((c) => `${c.year}: ${format(c.value)}`).join(', ');
    const height = tall ? give('6rem', '3rem') : give('3rem', '1.5rem');

    return (
        <div role="img" aria-label={`${label} — ${summary}`}>
            <p className="font-sans text-xs font-medium text-slate-500 sm:text-sm">{label}</p>
            <div className="mt-2 flex items-end gap-2 sm:gap-3">
                {columns.map((c, i) => {
                    const isNow = c.year === year;
                    return (
                        <div key={c.year} className="flex w-7 flex-col items-center sm:w-8">
                            <span
                                className="font-serif text-xs text-slate-500 tabular-nums sm:text-sm"
                                style={isNow ? { color: accent } : undefined}
                            >
                                {format(c.value)}
                            </span>
                            <motion.div
                                className={`mt-1 w-full rounded-t-[2px] ${isNow ? '' : 'bg-slate-500/40'}`}
                                style={{
                                    height: `max(2px, calc(${Math.max(0, Math.min(1, scale(c.value)))} * ${height}))`,
                                    transformOrigin: 'bottom',
                                    ...(isNow ? { backgroundColor: accent } : {}),
                                }}
                                initial={still ? false : { scaleY: 0 }}
                                animate={{ scaleY: 1 }}
                                transition={{
                                    duration: 0.6,
                                    delay: delay + i * 0.06,
                                    ease: [0.22, 1, 0.36, 1] as const,
                                }}
                            />
                            <span
                                className="mt-1 text-[10px] text-slate-500 tabular-nums sm:text-xs"
                                style={isNow ? { color: accent } : undefined}
                            >
                                ’{String(c.year).slice(2)}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
