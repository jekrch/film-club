import React from 'react';
import AccentCard from '../common/AccentCard';
import UnitValue from '../common/UnitValue';

interface StatCardProps {
    label: string;
    value: string | number;
    description?: string;
    valueClassName?: string;
    containerClassName?: string;
}

/**
 * A club-wide figure, set like the profile's stat cards: a small-caps label
 * ruled out across the card, the value in large serif numerals with any unit
 * words dropped to small caps.
 */
const StatCard: React.FC<StatCardProps> = ({
    label,
    value,
    description,
    valueClassName = 'text-slate-100 text-3xl sm:text-4xl',
}) => {
    return (
        // No rail: these repeat in a grid
        <AccentCard key={`card-${label}`} rail={false} className="p-4 sm:p-5">
            <div className="flex items-center gap-2.5">
                <p className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
                    {label}
                </p>
                <span className="h-px flex-1 bg-slate-600/40" aria-hidden="true" />
            </div>
            <p
                className={`mt-3 font-serif font-normal leading-none tracking-tight tabular-nums break-words ${valueClassName}`}
            >
                {typeof value === 'string' ? <UnitValue value={value} /> : value}
            </p>
            {description && (
                <p className="mt-2.5 text-xs leading-snug text-slate-500">{description}</p>
            )}
        </AccentCard>
    );
};

export default StatCard;
