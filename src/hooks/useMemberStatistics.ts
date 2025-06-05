import { useState, useEffect, useCallback } from 'react';
import { Film } from '../types/film';
import { TeamMember } from '../types/team';
import {
    calculateMemberStats as calculateMemberStatsUtil, 
    ComprehensiveMemberStats,
    MemberStatHighlight
} from '../utils/statUtils';
import { formatAverage as formatAverageUtil } from '../utils/statUtils';

export interface MemberStatsDataForAlmanac {
    member: TeamMember;
    stats: ComprehensiveMemberStats;
    highlights: {
        avgRuntime: MemberStatHighlight;
        avgSelectedScore: MemberStatHighlight;
        avgGivenScore: MemberStatHighlight;
        selectionCountryCount: MemberStatHighlight;
        avgSelectionYear: MemberStatHighlight;
        countryDiversityPercentage: MemberStatHighlight; 
    };
}

const formatYearForAlmanac = (year: number | null | undefined): string => {
    if (year === null || year === undefined || isNaN(year)) return 'N/A';
    return Math.round(year).toString();
};


export interface UseMemberStatisticsReturn {
    allMemberStats: MemberStatsDataForAlmanac[];
    getHighlightClass: (highlight: MemberStatHighlight) => string;
    formatAverage: (avg: number | null | undefined, digits?: number) => string | null; // Expose formatting
    formatYear: (year: number | null | undefined) => string; // Expose formatting
}

export const useMemberStatistics = (
    films: Film[],
    teamMembers: TeamMember[]
): UseMemberStatisticsReturn => {
    const [allMemberStats, setAllMemberStats] = useState<MemberStatsDataForAlmanac[]>([]);

    useEffect(() => {
        if (!films.length || !teamMembers.length) {
            setAllMemberStats([]);
            return;
        }

        const activeMembers = teamMembers.filter(m => typeof m.queue === 'number' && m.queue > 0);
        const memberStatsList = activeMembers.map(member => ({
            member,
            stats: calculateMemberStatsUtil(member.name, films)
        }));

        // Determine High/Low values for highlighting
        const findHighLow = (statKey: keyof ComprehensiveMemberStats): { high: number | null, low: number | null } => {
            let high: number | null = null;
            let low: number | null = null;
            let validStatsCount = 0;

            memberStatsList.forEach(({ stats }) => {
                const value = stats[statKey] as number | null; // Type assertion
                if (value !== null && typeof value === 'number' && !isNaN(value)) {
                    validStatsCount++;
                    if (high === null || value > high) high = value;
                    if (low === null || value < low) low = value;
                }
            });
            return validStatsCount >= 2 ? { high, low } : { high: null, low: null };
        };

        const highlightsMap = {
            avgRuntime: findHighLow('avgRuntime'),
            avgSelectedScore: findHighLow('avgSelectedScore'),
            avgGivenScore: findHighLow('avgGivenScore'),
            selectionCountryCount: findHighLow('selectionCountryCount'),
            avgSelectionYear: findHighLow('avgSelectionYear'),
            countryDiversityPercentage: findHighLow('countryDiversityPercentage'),
        };

        const finalStatsData: MemberStatsDataForAlmanac[] = memberStatsList.map(({ member, stats }) => {
            const getHighlight = (statKey: keyof MemberStatsDataForAlmanac['highlights'], value: number | null): MemberStatHighlight => {
                if (value === null || typeof value !== 'number' || isNaN(value)) return null;

                const { high, low } = (highlightsMap as any)[statKey]; // Access mapped highlights

                // Special handling for avgRuntime (lower is better) vs avgSelectionYear (higher might be seen as "more recent")
                // And selectionCountryCount (higher is better)
                // @ts-ignore
                let isHighValueGood = true;
                if (statKey === 'avgRuntime') isHighValueGood = false; // Lower runtime might be "better" if that's the goal

                const isHigh = high !== null && value === high && high !== low;
                const isLow = low !== null && value === low && high !== low;
                
                // For avgRuntime, 'low' is good, 'high' is bad (or vice-versa depending on perspective)
                // This logic directly maps to 'high' for high values and 'low' for low values.
                // The component using getHighlightClass will decide if 'high' is green or red.
                if (isHigh) return 'high';
                if (isLow) return 'low';
                return null;
            };

            return {
                member,
                stats,
                highlights: {
                    avgRuntime: getHighlight('avgRuntime', stats.avgRuntime),
                    avgSelectedScore: getHighlight('avgSelectedScore', stats.avgSelectedScore),
                    avgGivenScore: getHighlight('avgGivenScore', stats.avgGivenScore),
                    selectionCountryCount: getHighlight('selectionCountryCount', stats.selectionCountryCount),
                    avgSelectionYear: getHighlight('avgSelectionYear', stats.avgSelectionYear),
                    countryDiversityPercentage: getHighlight('countryDiversityPercentage', stats.countryDiversityPercentage),
                }
            };
        });

        setAllMemberStats(finalStatsData);

    }, [films, teamMembers]);

    const getHighlightClass = useCallback((highlight: MemberStatHighlight): string => {
        // This function determines the color based on 'high' or 'low'
        // Typically, 'high' is green (good) and 'low' is blue/red (bad or just different)
        // Adjust as per your visual requirements.
        if (highlight === 'high') return 'text-emerald-400 font-semibold';
        if (highlight === 'low') return 'text-blue-400 font-semibold'; // Or 'text-rose-400' if low is "bad"
        return 'text-slate-100 font-medium';
    }, []);

    return {
        allMemberStats,
        getHighlightClass,
        formatAverage: formatAverageUtil, // Pass through the util
        formatYear: formatYearForAlmanac,  // Pass through the util
    };
};