import React from 'react';
import AccentCard from '../common/AccentCard';

/**
 * Props for the ProfileStatCard component.
 */
export interface ProfileStatCardProps {
    /** Unique identifier for the statistic type. */
    id: string;
    /** The display label for the statistic. */
    label: string;
    /** The value of the statistic. Can be string, number, or array for top genres. */
    value: string | number | { genre: string; count: number }[] | React.ReactNode;
    /** Optional rank string (e.g., "1/10"). */
    rank?: string | null;
    /** Optional description text for the statistic. */
    description?: string;
    /** Optional CSS class name for the value element. */
    valueClassName?: string;
    /** Optional Heroicon component to display next to the label. */
    icon?: React.ElementType;
}

const ordinal = (n: number): string => {
    const tens = n % 100;
    if (tens >= 11 && tens <= 13) return `${n}th`;
    return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
};

/**
 * Sets the digits of a formatted value as large numerals and drops the unit
 * words ("hrs", "min") down to small caps beside them, so "12 hrs 34 min"
 * reads as two figures rather than one long string.
 */
const renderWithUnits = (value: string): React.ReactNode =>
    value.split(/(\d+(?:\.\d+)?)/).map((part, i) =>
        /^\d/.test(part) || part.trim() === '' ? (
            part
        ) : (
            <span
                key={i}
                className="mx-1 font-sans text-xs font-medium uppercase tracking-widest text-slate-400"
            >
                {part.trim()}
            </span>
        )
    );

/**
 * One tick per ranked member, left to right from first place, with this
 * member's tick raised. First place is marked in amber, the color the ranked
 * lists use for position.
 */
const RankMeter: React.FC<{ position: number; total: number }> = ({ position, total }) => (
    <div className="flex items-center gap-3">
        <div
            className="flex h-3 flex-1 items-end gap-[3px]"
            role="img"
            aria-label={`Ranked ${ordinal(position)} of ${total} members`}
            title={`${ordinal(position)} of ${total} members`}
        >
            {Array.from({ length: total }, (_, i) => {
                const isMember = i + 1 === position;
                return (
                    <span
                        key={i}
                        className={`flex-1 rounded-[1px] transition-colors duration-300 ${
                            isMember
                                ? `h-3 ${position === 1 ? 'bg-amber-400' : 'bg-blue-300'}`
                                : 'h-1.5 bg-slate-600/50 group-hover/card:bg-slate-500/50'
                        }`}
                    />
                );
            })}
        </div>
        <span className="whitespace-nowrap text-xs tabular-nums text-slate-500">
            <span className={position === 1 ? 'text-amber-300' : 'text-slate-200'}>
                {ordinal(position)}
            </span>{' '}
            of {total}
        </span>
    </div>
);

/**
 * Genres as a short ranked list, each with a bar scaled to the leader so the
 * gap between first and third is visible, not just stated.
 */
const GenreBars: React.FC<{ genres: { genre: string; count: number }[] }> = ({ genres }) => {
    const max = Math.max(...genres.map((g) => g.count), 1);
    return (
        <ol className="space-y-2.5">
            {genres.map(({ genre, count }, i) => (
                <li key={genre}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span
                            className={`truncate ${i === 0 ? 'text-slate-100' : 'text-slate-300'}`}
                        >
                            {genre}
                        </span>
                        <span className="font-serif tabular-nums text-slate-400">{count}</span>
                    </div>
                    <div className="mt-1 h-[3px] rounded-full bg-slate-600/30">
                        <div
                            className={`h-full rounded-full ${i === 0 ? 'bg-blue-300/80' : 'bg-slate-400/40'}`}
                            style={{ width: `${(count / max) * 100}%` }}
                        />
                    </div>
                </li>
            ))}
        </ol>
    );
};

/**
 * Displays a single statistic in a card format: a small-caps label ruled out
 * to the icon, the value set in large serif numerals, and — when the stat is
 * ranked — a meter placing the member among the rest of the club.
 */
const ProfileStatCard: React.FC<ProfileStatCardProps> = ({
    id,
    label,
    value,
    rank,
    description,
    valueClassName = 'text-slate-100', // Default value class
    icon: IconComponent,
}) => {
    // Determine if the value should be considered empty for rendering purposes.
    // Allows 0 for specific stats like totalSelections.
    const isValueConsideredEmpty =
        value === null ||
        value === undefined ||
        value === '' ||
        value === 'N/A' ||
        (id === 'topGenres' && (!Array.isArray(value) || value.length === 0)) ||
        (typeof value === 'number' && isNaN(value));

    // Conditionally render the card: hide if empty, unless it's totalSelections with a value of 0.
    if (isValueConsideredEmpty && !(id === 'totalSelections' && value === 0)) {
        return null;
    }

    // Parse "3/10" into a meter position. Genres aren't ranked.
    let rankMeter = null;
    if (rank && typeof rank === 'string' && rank.includes('/') && id !== 'topGenres') {
        const [position, total] = rank.split('/').map(Number);
        if (position > 0 && total > 0) {
            rankMeter = <RankMeter position={position} total={total} />;
        }
    }

    return (
        // No rail: these repeat in a grid, where a wall of rails reads as noise
        <AccentCard
            rail={false}
            surface="inset"
            className="min-h-[132px]"
            contentClassName="flex h-full flex-col p-4"
        >
            <div className="flex items-center gap-2.5">
                <h4
                    className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400"
                    title={label}
                >
                    {label}
                </h4>
                <span className="h-px flex-1 bg-slate-600/40" aria-hidden="true" />
                {IconComponent && (
                    <IconComponent
                        className="h-4 w-4 flex-shrink-0 text-slate-500 transition-colors duration-300 group-hover/card:text-blue-300/80"
                        aria-hidden="true"
                    />
                )}
            </div>

            <div className="mt-3">
                {id === 'topGenres' && Array.isArray(value) ? (
                    <GenreBars genres={value} />
                ) : (
                    <p
                        className={`font-serif text-4xl font-normal leading-none tracking-tight tabular-nums break-words ${valueClassName}`}
                    >
                        {typeof value === 'string'
                            ? renderWithUnits(value)
                            : (value as React.ReactNode)}
                    </p>
                )}
            </div>

            {description && (
                <p className="mt-2.5 text-xs leading-snug text-slate-500">{description}</p>
            )}

            {/* Pinned to the bottom so meters line up across a row of cards */}
            {rankMeter && <div className="mt-auto pt-4">{rankMeter}</div>}
        </AccentCard>
    );
};

export default ProfileStatCard;
