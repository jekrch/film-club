import React, { useState, useMemo } from 'react';
import {
  FilmIcon, ClockIcon, PencilSquareIcon, LanguageIcon, MapPinIcon, TagIcon, TrophyIcon, ArrowsRightLeftIcon, ChevronUpIcon, ChevronDownIcon
} from '@heroicons/react/24/outline';
import { UserProfileStats, UserRankings, formatTotalRuntime, formatAverage } from '../../utils/statUtils'; // Adjust path as needed
import ProfileStatCard from './ProfileStatCard';

/**
 * Props for the ProfileStatsSection component.
 */
interface ProfileStatsSectionProps {
  /** The calculated statistics for the user profile. */
  stats: UserProfileStats | null;
  /** The calculated rankings for the user profile. */
  rankings: UserRankings | null;
}

/**
 * Configuration interface for defining how each stat card is generated.
 */
interface StatCardConfig {
  /** Unique key matching a property in UserProfileStats. */
  id: keyof UserProfileStats;
  /** Display label for the stat card. */
  label: string;
  /** Function to extract the raw value from the stats object. */
  getValue: (stats: UserProfileStats) => number | string | null | { genre: string; count: number }[];
  /** Optional function to format the raw value for display. */
  formatValue?: (value: any) => string | number | null;
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

  // Memoize the configuration array for stat cards to avoid recalculation on every render
  const statCardDefinitions: StatCardConfig[] = useMemo(() => [
    { id: 'totalSelections', label: "Films Selected", getValue: (s) => s.totalSelections, formatValue: (v) => (v !== null ? v : null), icon: FilmIcon },
    { id: 'totalRuntime', label: "Total Runtime (Selected)", getValue: (s) => s.totalRuntime, formatValue: formatTotalRuntime, getRank: (r) => r.totalRuntimeRank, description: "Total duration of selected films.", icon: ClockIcon },
    { id: 'avgRuntime', label: "Avg. Runtime (Selected)", getValue: (s) => s.avgRuntime, formatValue: (v) => { const f = formatAverage(v, 0); return f ? `${f} min` : null; }, getRank: (r) => r.avgRuntimeRank, description: "Average duration per selected film.", icon: ClockIcon },
    { id: 'topGenres', label: "Top Genres (Selected)", getValue: (s) => s.topGenres, description: "Most frequently selected genres (Top 3).", icon: TagIcon },
    { id: 'avgSelectedScore', label: "Avg. Club Score (Selected)", getValue: (s) => s.avgSelectedScore, formatValue: (v) => formatAverage(v, 2), getRank: (r) => r.avgSelectedScoreRank, description: "Avg. score on selected films (min. 2 ratings).", icon: TrophyIcon },
    { id: 'avgGivenScore', label: "Avg. Score Given", getValue: (s) => s.avgGivenScore, formatValue: (v) => formatAverage(v, 2), getRank: (r) => r.avgGivenScoreRank, description: "Avg. score given to any club film.", icon: PencilSquareIcon },
    { id: 'avgDivergence', label: "Avg. Score Divergence", getValue: (s) => s.avgDivergence,
      formatValue: (v) => {
          const formatted = formatAverage(v, 2);
          if (formatted === null) return null;
          const value = parseFloat(formatted);
          // Explicitly add '+' for positive values (and avoid adding for near-zero floats)
          if (value > 1e-9) return `+${formatted}`;
          return formatted; // Negative sign is handled automatically
        },
      getRank: (r) => r.avgDivergenceRank,
      description: "Avg. difference from others' scores (Their Score - Others' Avg).", icon: ArrowsRightLeftIcon },
    { id: 'languageCount', label: "Unique Languages (Selected)", getValue: (s) => s.languageCount, formatValue: (v) => (v !== null && v > 0 ? v : null), description: "Primary languages of selected films.", icon: LanguageIcon },
    { id: 'countryCount', label: "Unique Countries (Selected)", getValue: (s) => s.countryCount, formatValue: (v) => (v !== null && v > 0 ? v : null), description: "Primary countries of selected films.", icon: MapPinIcon },
  ], []); // Empty dependency array ensures this runs only once

  // Memoize the processed list of stat cards to display, applying formatting and filtering
  const visibleStatCards = useMemo(() => {
    if (!stats) return []; // Return empty if no stats data

    return statCardDefinitions
      .map(config => {
        const rawValue = config.getValue(stats);
        let displayValue: string | number | null | { genre: string; count: number }[] = null;

        // Handle specific formatting or pass-through
        if (config.id === 'topGenres') {
          displayValue = (Array.isArray(rawValue) && rawValue.length > 0) ? rawValue : null;
        } else if (config.formatValue) {
          displayValue = config.formatValue(rawValue);
        } else {
          const allowZero = config.id === 'totalSelections';
          displayValue = (rawValue !== null && (rawValue !== 0 || allowZero)) ? rawValue as (string | number) : null;
        }

        // Check if the final display value is effectively empty
        const isEffectivelyEmpty = displayValue === null || displayValue === '' || displayValue === 'N/A' || (config.id === 'topGenres' && (!Array.isArray(displayValue) || displayValue.length === 0));

        // Get rank and determine value class name
        const rank = (config.getRank && rankings) ? config.getRank(rankings) : null;
        let className = "text-slate-100"; // Default class
        if (config.id !== 'topGenres') { // Apply custom class logic only if not topGenres
            if (typeof config.valueClassName === 'function') className = config.valueClassName(rank);
            else if (typeof config.valueClassName === 'string') className = config.valueClassName;
        }

        return { ...config, displayValue, displayRank: rank, displayClassName: className, isEffectivelyEmpty };
      })
      // Filter out cards that are effectively empty, but keep 'totalSelections' if its value is 0
      .filter(card => !card.isEffectivelyEmpty || (card.id === 'totalSelections' && card.displayValue === 0));
  }, [stats, rankings, statCardDefinitions]); // Dependencies for recalculation

  // Don't render the section if there are no valid stats to display
  if (!stats || visibleStatCards.length === 0) {
    return null;
  }

  // Determine if the expansion button is needed
  const needsExpansion = visibleStatCards.length > MAX_VISIBLE_CARDS_COLLAPSED;
  // Define max-height classes for smooth transition
  const collapsedMaxHeight = 'max-h-72'; // ~18rem
  const expandedMaxHeight = 'max-h-[3000px]'; // Effectively unlimited height

  return (
    <div className="bg-slate-800 rounded-lg p-6 md:p-8 border border-slate-700 shadow-xl shadow-slate-950/30 h-full">
      <h3 className="text-2xl font-bold text-slate-100 mb-5 border-b border-slate-700 pb-3">
        Member Stats
      </h3>
      {/* Container managing the expand/collapse animation */}
      <div className={`transition-all duration-500 ease-in-out overflow-hidden ${!isExpanded && needsExpansion ? collapsedMaxHeight : expandedMaxHeight}`}>
           {/* Inner container for padding/margin adjustments, if needed */}
           <div className={`pr-2 -mr-2`}> {/* Adjust padding for potential scrollbar */}
               {/* Grid layout for the stat cards */}
               <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                   {visibleStatCards.map((card) => (
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
                       />
                   ))}
               </div>
           </div>
      </div>
      {/* Render the expand/collapse button if needed */}
      {needsExpansion && (
        <div className="mt-4 text-center border-t border-slate-700 pt-4">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-blue-400 hover:text-blue-300 text-sm font-medium inline-flex items-center"
            aria-expanded={isExpanded} // Accessibility attribute
          >
            {isExpanded ? (
              <> Show Less Stats <ChevronUpIcon className="h-4 w-4 ml-1" aria-hidden="true" /> </>
            ) : (
              <> Show All Stats ({visibleStatCards.length} total) <ChevronDownIcon className="h-4 w-4 ml-1" aria-hidden="true" /> </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default ProfileStatsSection;