import React from 'react';

interface PlotParagraphsProps {
    /** The film's synopsis, as the source wrote it — newlines and all. */
    plot: string | null | undefined;
    /** Applied to every paragraph, so a caller sets its own measure and type. */
    className?: string;
    /** Space between paragraphs. A Tailwind margin class, on all but the last. */
    gapClassName?: string;
    /** What to draw when there is no plot to draw. Nothing, by default. */
    fallback?: React.ReactNode;
}

/**
 * A plot as the paragraphs it was written in.
 *
 * The synopses in `films.json` and in the list summary cache carry newlines —
 * OMDB and TMDb both hand back multi-paragraph blurbs for anything longer than
 * a logline — and a single `<p>` collapses them into one wall of text. Every
 * place that shows a plot splits it here instead, so the wall's panel, the watch
 * log's panel and the film page all break it in the same places.
 *
 * Blank runs are dropped rather than turned into empty paragraphs: a source that
 * separates its paragraphs with `\n\n` should not open a hole between them.
 */
const PlotParagraphs: React.FC<PlotParagraphsProps> = ({
    plot,
    className,
    gapClassName = 'mb-3',
    fallback = null,
}) => {
    const paragraphs = (plot ?? '')
        .split(/\n+/)
        .map((paragraph) => paragraph.trim())
        .filter((paragraph) => paragraph !== '');

    if (paragraphs.length === 0) return <>{fallback}</>;

    return (
        <>
            {paragraphs.map((paragraph, index) => (
                <p
                    key={index}
                    className={
                        index < paragraphs.length - 1 && gapClassName
                            ? `${className ?? ''} ${gapClassName}`.trim()
                            : className
                    }
                >
                    {paragraph}
                </p>
            ))}
        </>
    );
};

export default PlotParagraphs;
