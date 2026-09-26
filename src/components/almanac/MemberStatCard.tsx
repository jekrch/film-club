import React from 'react';
import { Link } from 'react-router-dom';
import CircularImage from '../common/CircularImage';
import StatItem from './StatItem';
import { MemberStatsData, TeamMember } from '../../types/team';
import { ComprehensiveMemberStats } from '../../utils/statUtils';
import AccentCard from '../common/AccentCard';

interface MemberStatCardProps {
    member: TeamMember;
    stats: ComprehensiveMemberStats;
    highlights: {
        avgSelectionRuntime: MemberStatsData;
        avgSelectionScore: MemberStatsData;
        avgGivenScore: MemberStatsData;
        selectionCountryCount: MemberStatsData;
        countryDiversityPercentage: MemberStatsData;
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
    getHighlightClass,
}) => {
    return (
        // No rail: one card per member, repeating in a grid
        <AccentCard rail={false} contentClassName="flex h-full flex-col p-4">
            {/* Member header, a small title card like the profile banner's: the
                member's role as a small-caps credit over their name in serif. */}
            <div className="mb-4 flex items-center border-b border-slate-700/60 pb-3">
                <Link
                    to={`/profile/${encodeURIComponent(member.name)}`}
                    className="group relative flex min-w-0 items-center"
                    title={`View ${member.name}'s profile`}
                >
                    <CircularImage
                        alt={member.name}
                        size="w-10 h-10 sm:w-12 sm:h-12"
                        className="mr-3 flex-shrink-0 border-2 border-slate-600"
                    />
                    <div className="min-w-0">
                        {member.title && (
                            <p className="truncate text-[10px] font-medium uppercase tracking-[0.2em] text-blue-300/80">
                                {member.title}
                            </p>
                        )}
                        <h4 className="truncate font-serif text-lg leading-snug text-slate-100 transition-colors group-hover:text-blue-300">
                            {member.name}
                        </h4>
                    </div>
                </Link>
            </div>
            {/* Stats list. Every figure but "Score Given" is over the films this
                member selected; the tooltips say so. */}
            <div className="space-y-2.5 text-sm flex-grow">
                <StatItem
                    label="Selections"
                    value={stats.totalSelections}
                    tooltip="Films selected by this member"
                />
                <StatItem
                    label="Avg Runtime"
                    tooltip="Average runtime of films selected by this member"
                    value={stats.avgRuntime ? `${Math.round(stats.avgRuntime)} min` : 'N/A'}
                    valueClassName={getHighlightClass(highlights.avgSelectionRuntime)}
                />
                <StatItem
                    label="Avg Club Score"
                    value={`${formatAverage(stats.avgSelectedScore, 2)} / 9`}
                    valueClassName={getHighlightClass(highlights.avgSelectionScore)}
                    tooltip="Average club score for films selected by this member, only including films with 2+ ratings"
                />
                <StatItem
                    label="Avg Score Given"
                    value={`${formatAverage(stats.avgGivenScore, 2)} / 9`}
                    valueClassName={getHighlightClass(highlights.avgGivenScore)}
                    tooltip="Average score this member has given across every film they rated"
                />
                <StatItem
                    label="Countries"
                    value={
                        stats.totalSelections > 0
                            ? `${stats.selectionCountryCount} (${Math.round((stats.selectionCountryCount / stats.totalSelections) * 100)}%)`
                            : 'N/A'
                    }
                    tooltip="Unique countries among films selected by this member, with diversity percentage"
                    valueClassName={getHighlightClass(highlights.countryDiversityPercentage)}
                />
                <StatItem
                    label="Avg Year"
                    value={formatYear(stats.avgSelectionYear)}
                    tooltip="Average release year of films selected by this member"
                    valueClassName={getHighlightClass(highlights.avgSelectionYear)}
                />
            </div>
        </AccentCard>
    );
};

export default MemberStatCard;
