import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
    FilmIcon,
    ClockIcon,
    PencilSquareIcon,
    LanguageIcon,
    MapPinIcon,
    TagIcon,
    TrophyIcon,
    ArrowsRightLeftIcon,
    ChevronUpIcon,
    ChevronDownIcon,
} from '@heroicons/react/24/outline';
import {
    UserProfileStats,
    UserRankings,
    formatTotalRuntime,
    formatAverage,
} from '../../utils/statUtils';
import ProfileStatCard from './ProfileStatCard';
import AccentCard from '../common/AccentCard';
import Button from '../common/Button';

/**
 * Props for the ProfileStatsSection component.
 */
interface ProfileStatsSectionProps {
    /** The calculated statistics for the user profile. */
    stats: UserProfileStats | null;
    /** The calculated rankings for the user profile. */
    rankings: UserRankings | null;
}

/** Headed groups the stats are sorted into, in display order. */
const STAT_GROUPS = ['Selections', 'Scoring', 'Range'] as const;

/**
 * Configuration interface for defining how each stat card is generated.
 */
interface StatCardConfig {
    /** Unique key matching a property in UserProfileStats. */
    id: keyof UserProfileStats;
    /** The group the stat is listed under. */
    group: (typeof STAT_GROUPS)[number];
    /** Display label for the stat card. */
    label: string;
    /** Function to extract the raw value from the stats object. */
    getValue: (
        stats: UserProfileStats
    ) => number | string | null | { genre: string; count: number }[];
    /** Optional function to format the raw value for display. */
    formatValue?: (
        value: any,
        stats?: UserProfileStats
    ) => string | number | null | React.ReactNode;
    /** Optional function to extract the rank string from the rankings object. */
    getRank?: (rankings: UserRankings) => string | null;
    /** Optional description text for the stat card. */
    description?: string;
    /** Heroicon component for the stat card. */
    icon: React.ElementType;
    /** Optional CSS class name or function returning a class name for the value element. */
    valueClassName?: string | ((rank: string | null) => string);
}

/**
 * Renders a section displaying various profile statistics using ProfileStatCard components.
 * Includes logic for expanding/collapsing the list of stats.
 */
const ProfileStatsSection: React.FC<ProfileStatsSectionProps> = ({ stats, rankings }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    // Max number of cards to show when collapsed
    const MAX_VISIBLE_CARDS_COLLAPSED = 8;
    // Collapsed height on phones, where the cards stack. From sm everything shows;
    // see .stats-collapse.
    const COLLAPSED_HEIGHT_REM = 21;

    // Memoize the configuration array for stat cards to avoid recalculation on every render
    const statCardDefinitions: StatCardConfig[] = useMemo(
        () => [
            {
                id: 'totalSelections',
                group: 'Selections',
                label: 'Films Selected',
                getValue: (s) => s.totalSelections,
                formatValue: (v) => (v !== null ? v : null),
                icon: FilmIcon,
            },
            {
                id: 'totalRuntime',
                group: 'Selections',
                label: 'Total Runtime',
                getValue: (s) => s.totalRuntime,
                formatValue: formatTotalRuntime,
                getRank: (r) => r.totalRuntimeRank,
                description: 'Total duration of selected films.',
                icon: ClockIcon,
            },
            {
                id: 'avgRuntime',
                group: 'Selections',
                label: 'Avg. Runtime',
                getValue: (s) => s.avgRuntime,
                formatValue: (v) => {
                    const f = formatAverage(v, 0);
                    return f ? `${f} min` : null;
                },
                getRank: (r) => r.avgRuntimeRank,
                description: 'Average duration per selected film.',
                icon: ClockIcon,
            },
            {
                id: 'avgSelectedScore',
                group: 'Scoring',
                label: 'Avg. Club Score',
                getValue: (s) => s.avgSelectedScore,
                formatValue: (v) => formatAverage(v, 2),
                getRank: (r) => r.avgSelectedScoreRank,
                description: 'Avg. score on selected films (min. 2 ratings).',
                icon: TrophyIcon,
            },
            {
                id: 'avgGivenScore',
                group: 'Scoring',
                label: 'Avg. Score Given',
                getValue: (s) => s.avgGivenScore,
                formatValue: (v) => formatAverage(v, 2),
                getRank: (r) => r.avgGivenScoreRank,
                description: 'Avg. score given to any club film.',
                icon: PencilSquareIcon,
            },
            {
                id: 'avgDivergence',
                group: 'Scoring',
                label: 'Avg. Divergence',
                getValue: (s) => s.avgAbsoluteDivergence, // Change this to use absolute!
                formatValue: (v) => formatAverage(v, 2), // Remove the +/- logic
                getRank: (r) => r.avgDivergenceRank,
                description: "Avg. absolute difference from others' scores.",
                icon: ArrowsRightLeftIcon,
            },
            {
                id: 'languageCount',
                group: 'Range',
                label: 'Languages',
                getValue: (s) => s.languageCount,
                formatValue: (v) => (v !== null && v > 0 ? v : null),
                description: 'Primary languages of selected films.',
                icon: LanguageIcon,
            },
            {
                id: 'countryCount',
                group: 'Range',
                label: 'Countries',
                getValue: (s) => s.countryCount,
                formatValue: (v: any, stats?: UserProfileStats) => {
                    if (v === null || v === 0) return null;

                    // Calculate diversity percentage if we have the stats
                    if (stats && stats.totalSelections > 0) {
                        const diversityPercentage = Math.round((v / stats.totalSelections) * 100);
                        return (
                            <>
                                {v}{' '}
                                <span
                                    title="diversity percentage"
                                    className="ml-1 font-sans text-sm tracking-normal text-slate-400"
                                >
                                    ({diversityPercentage}%)
                                </span>
                            </>
                        );
                    }

                    // Fallback to just the count if we can't calculate percentage
                    return v;
                },
                getRank: (r) => r.countryDiversityRank,
                description: 'Primary countries of selected films.',
                icon: MapPinIcon,
            },
            {
                id: 'topGenres',
                group: 'Range',
                label: 'Top Genres',
                getValue: (s) => s.topGenres,
                description: 'Most frequently selected genres.',
                icon: TagIcon,
            },
        ],
        []
    ); // Empty dependency array ensures this runs only once

    // Memoize the processed list of stat cards to display, applying formatting and filtering
    const visibleStatCards = useMemo(() => {
        if (!stats) return []; // Return empty if no stats data

        return (
            statCardDefinitions
                .map((config) => {
                    const rawValue = config.getValue(stats);
                    let displayValue:
                        | string
                        | number
                        | null
                        | React.ReactNode
                        | { genre: string; count: number }[] = null;

                    // Handle specific formatting or pass-through
                    if (config.id === 'topGenres') {
                        displayValue =
                            Array.isArray(rawValue) && rawValue.length > 0 ? rawValue : null;
                    } else if (config.formatValue) {
                        displayValue = config.formatValue(rawValue, stats);
                    } else {
                        const allowZero = config.id === 'totalSelections';
                        displayValue =
                            rawValue !== null && (rawValue !== 0 || allowZero)
                                ? (rawValue as string | number)
                                : null;
                    }

                    // Check if the final display value is effectively empty
                    const isEffectivelyEmpty =
                        displayValue === null ||
                        displayValue === '' ||
                        displayValue === 'N/A' ||
                        (config.id === 'topGenres' &&
                            (!Array.isArray(displayValue) || displayValue.length === 0));

                    // Get rank and determine value class name
                    const rank = config.getRank && rankings ? config.getRank(rankings) : null;
                    let className = 'text-slate-100'; // Default class
                    if (config.id !== 'topGenres') {
                        // Apply custom class logic only if not topGenres
                        if (typeof config.valueClassName === 'function')
                            className = config.valueClassName(rank);
                        else if (typeof config.valueClassName === 'string')
                            className = config.valueClassName;
                    }

                    return {
                        ...config,
                        displayValue,
                        displayRank: rank,
                        displayClassName: className,
                        isEffectivelyEmpty,
                    };
                })
                // Filter out cards that are effectively empty, but keep 'totalSelections' if its value is 0
                .filter(
                    (card) =>
                        !card.isEffectivelyEmpty ||
                        (card.id === 'totalSelections' && card.displayValue === 0)
                )
        );
    }, [stats, rankings, statCardDefinitions]); // Dependencies for recalculation

    // Track the grid's natural height so expanding animates to exactly that.
    // Re-run when the cards change, since the grid isn't mounted while empty.
    const contentRef = useRef<HTMLDivElement>(null);
    const [contentHeight, setContentHeight] = useState<number | null>(null);
    useEffect(() => {
        const el = contentRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => setContentHeight(el.offsetHeight));
        observer.observe(el);
        return () => observer.disconnect();
    }, [visibleStatCards]);

    // Don't render the section if there are no valid stats to display
    if (!stats || visibleStatCards.length === 0) {
        return null;
    }

    // Determine if the expansion button is needed
    const needsExpansion = visibleStatCards.length > MAX_VISIBLE_CARDS_COLLAPSED;
    const isCollapsed = needsExpansion && !isExpanded;

    // Animate to the grid's measured height rather than a large placeholder:
    // against a placeholder the easing plays out over empty space, so opening
    // lands almost instantly and closing sits still before anything moves.
    // Without a measurement (first paint, no ResizeObserver) it simply snaps.
    let maxHeight: string | undefined;
    if (isCollapsed) {
        maxHeight = `${COLLAPSED_HEIGHT_REM}rem`;
    } else if (needsExpansion && contentHeight !== null) {
        maxHeight = `${contentHeight}px`;
    }

    return (
        <AccentCard className="h-full">
            <h3 className="text-2xl font-bold text-slate-100 mb-5 border-b border-slate-700/60 pb-3">
                Member Stats
            </h3>
            {/* Container managing the expand/collapse animation; see .stats-collapse */}
            <div
                className={needsExpansion ? 'stats-collapse' : undefined}
                data-collapsed={isCollapsed}
                style={{ maxHeight }}
            >
                {/* Inner container for padding/margin adjustments, if needed */}
                <div ref={contentRef} className={`pr-2 -mr-2`}>
                    {' '}
                    {/* Adjust padding for potential scrollbar */}
                    {STAT_GROUPS.map((group) => {
                        const cards = visibleStatCards.filter((card) => card.group === group);
                        if (cards.length === 0) return null;
                        return (
                            // The section head's rule stands in for the first group's
                            <div
                                key={group}
                                className="mt-7 border-t border-slate-700/60 pt-5 first:mt-0 first:border-t-0 first:pt-0"
                            >
                                <h4 className="mb-4 text-sm font-semibold text-slate-200">
                                    {group}
                                </h4>
                                {/* Three tracks even for a short group, so columns line up
                                    from one group to the next */}
                                <div className="grid grid-cols-1 divide-y divide-slate-700/40 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                                    {cards.map((card) => (
                                        <ProfileStatCard
                                            key={card.id}
                                            id={card.id}
                                            label={card.label}
                                            // Assert non-null as empty cards are filtered out
                                            value={card.displayValue!}
                                            rank={card.displayRank}
                                            description={card.description}
                                            icon={card.icon}
                                            valueClassName={card.displayClassName}
                                            className="py-4 first:pt-0 last:pb-0 sm:px-5 sm:py-0 sm:first:pl-0 sm:last:pr-0"
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            {/* Render the expand/collapse button if needed */}
            {needsExpansion && (
                <div className="mt-4 text-center border-t border-slate-700/60 pt-4 sm:hidden">
                    <Button
                        onClick={() => setIsExpanded(!isExpanded)}
                        variant="link"
                        aria-expanded={isExpanded} // Accessibility attribute
                    >
                        {isExpanded ? (
                            <>
                                {' '}
                                Show Less Stats{' '}
                                <ChevronUpIcon className="h-4 w-4" aria-hidden="true" />{' '}
                            </>
                        ) : (
                            <>
                                {' '}
                                Show All Stats ({visibleStatCards.length} total){' '}
                                <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />{' '}
                            </>
                        )}
                    </Button>
                </div>
            )}
        </AccentCard>
    );
};

export default ProfileStatsSection;
