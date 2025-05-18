
import React from 'react';
import { Link } from 'react-router-dom';
import CircularImage from '../common/CircularImage';
import StatItem from './StatItem'; 
import { MemberStatsData, TeamMember } from '../../types/team';  
import { ComprehensiveMemberStats } from '../../utils/statUtils';
import BaseCard from '../common/BaseCard';

interface MemberStatCardProps {
    member: TeamMember;
    stats: ComprehensiveMemberStats;
    highlights: {
        avgSelectionRuntime: MemberStatsData;
        avgSelectionScore: MemberStatsData;
        avgGivenScore: MemberStatsData;
        selectionCountryCount: MemberStatsData;
        avgSelectionYear: MemberStatsData;
    };
    formatAverage: (avg: number | null | undefined, digits?: number) => string | null;
    formatYear: (year: number | null | undefined) => string;
    getHighlightClass: (highlight: MemberStatsData) => string;
}

const MemberStatCard: React.FC<MemberStatCardProps> = ({
    member,
    stats,
    highlights,
    formatAverage,
    formatYear,
    getHighlightClass
}) => {
    return (
        <BaseCard className="flex flex-col !bg-slate-800">
            {/* Member Header */}
            <div className="flex items-center mb-4 border-b border-slate-700 pb-3">
                <Link
                    to={`/profile/${encodeURIComponent(member.name)}`}
                    className="group transition-all duration-200 ease-in-out relative flex items-center"
                    title={''} // Title attribute intentionally left empty as per original code
                >
                    <CircularImage alt={member.name} size="w-10 h-10 sm:w-12 sm:h-12" className="border-2 border-slate-600 mr-3" />
                    <h4 className="text-base sm:text-lg font-semibold text-slate-300 group-hover:text-blue-400">{member.name}</h4>
                </Link>
            </div>
            {/* Stats List */}
            <div className="space-y-2 text-sm flex-grow">
                <StatItem
                    label="Selections Made"
                    value={stats.totalSelections}
                />
                <StatItem
                    label="Avg Runtime (Sel.)"
                    value={stats.avgRuntime ? `${Math.round(stats.avgRuntime)} min` : 'N/A'}
                    valueClassName={getHighlightClass(highlights.avgSelectionRuntime)}
                />
                <StatItem
                    label="Avg Club Score (Sel.)"
                    value={`${formatAverage(stats.avgSelectedScore)} / 9`}
                    valueClassName={getHighlightClass(highlights.avgSelectionScore)}
                    tooltip="Average club score for films selected by this member, only including films with 2+ ratings"
                />
                <StatItem
                    label="Avg Score Given"
                    value={`${formatAverage(stats.avgGivenScore)} / 9`}
                    valueClassName={getHighlightClass(highlights.avgGivenScore)}
                />
                <StatItem
                    label="Unique Countries (Sel.)"
                    value={stats.selectionCountryCount}                  
                />
                <StatItem
                    label="Avg Year (Sel.)"
                    value={formatYear(stats.avgSelectionYear)}
                    valueClassName={getHighlightClass(highlights.avgSelectionYear)}
                />
            </div>
        </BaseCard>
    );
};

export default MemberStatCard;