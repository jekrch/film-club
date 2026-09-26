import React from 'react';
import AccentCard, { CardAccent } from '../common/AccentCard';

interface ChartContainerProps {
    children: React.ReactNode;
    /** Spacing/layout classes only — the surface comes from AccentCard. */
    className?: string;
    accent?: CardAccent;
    /**
     * The chart's title, set here as a serif section head rather than drawn by
     * Highcharts, so it matches the rest of the page.
     */
    title?: string;
    /** A short small-caps figure at the end of the title's rule ("24 countries"). */
    meta?: React.ReactNode;
}

const ChartContainer: React.FC<ChartContainerProps> = ({
    children,
    className = 'mb-4',
    accent = 'blue',
    title,
    meta,
}) => {
    return (
        <AccentCard accent={accent} className={`p-3 sm:p-4 md:p-5 ${className}`}>
            {/* The profile's Lists head: title, a rule ruled out from it, and a
                count at the far end. */}
            {title && (
                <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 px-1 pt-1">
                    <h4 className="font-serif text-xl italic text-slate-100">{title}</h4>
                    <span
                        className="h-px flex-grow self-center bg-gradient-to-r from-blue-400/25 via-slate-700/60 to-transparent"
                        aria-hidden="true"
                    />
                    {meta && (
                        <span className="whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                            {meta}
                        </span>
                    )}
                </div>
            )}
            {children}
        </AccentCard>
    );
};

export default ChartContainer;
