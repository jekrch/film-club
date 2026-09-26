import React from 'react';

interface StatItemProps {
    label: string;
    value: string | number;
    valueClassName?: string;
    tooltip?: string;
}

/**
 * One line of a member's almanac card: a small-caps label and a serif figure,
 * joined by a dotted leader like a table of contents.
 */
const StatItem: React.FC<StatItemProps> = ({
    label,
    value,
    valueClassName = 'text-slate-100',
    tooltip,
}) => {
    return (
        <div className="flex items-baseline gap-2" title={tooltip}>
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
                {label}
            </span>
            <span
                className="min-w-[1rem] flex-1 border-b border-dotted border-slate-600/50"
                aria-hidden="true"
            />
            <span className={`font-serif tabular-nums whitespace-nowrap ${valueClassName}`}>
                {value}
            </span>
        </div>
    );
};

export default StatItem;
