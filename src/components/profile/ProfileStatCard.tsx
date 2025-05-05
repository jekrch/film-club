import React from 'react';
import { HashtagIcon } from '@heroicons/react/24/outline';

/**
 * Props for the ProfileStatCard component.
 */
export interface ProfileStatCardProps {
  /** Unique identifier for the statistic type. */
  id: string;
  /** The display label for the statistic. */
  label: string;
  /** The value of the statistic. Can be string, number, or array for top genres. */
  value: string | number | { genre: string; count: number }[];
  /** Optional rank string (e.g., "1/10"). */
  rank?: string | null;
  /** Optional description text for the statistic. */
  description?: string;
  /** Optional CSS class name for the value element. */
  valueClassName?: string;
  /** Optional Heroicon component to display next to the label. */
  icon?: React.ElementType;
}

/**
 * Displays a single statistic in a card format, including label, value, optional icon, rank, and description.
 */
const ProfileStatCard: React.FC<ProfileStatCardProps> = ({
  id,
  label,
  value,
  rank,
  description,
  valueClassName = "text-slate-100", // Default value class
  icon: IconComponent
}) => {
  // Determine if the value should be considered empty for rendering purposes.
  // Allows 0 for specific stats like totalSelections.
  const isValueConsideredEmpty = value === null || value === undefined || value === '' || value === 'N/A'
                               || (id === 'topGenres' && (!Array.isArray(value) || value.length === 0))
                               || (typeof value === 'number' && isNaN(value));

  // Conditionally render the card: hide if empty, unless it's totalSelections with a value of 0.
  if (isValueConsideredEmpty && !(id === 'totalSelections' && value === 0)) {
       return null;
   }


  // Format rank display if available and valid
  let rankDisplay = null;
  if (rank && typeof rank === 'string' && rank.includes('/') && id !== 'topGenres') {
    const [rankNum, totalNum] = rank.split('/');
    rankDisplay = (
      <span className="text-sm font-normal text-slate-400 ml-2 whitespace-nowrap ">
        <HashtagIcon className="inline h-3 w-3 mr-0.5 relative -top-px" aria-hidden="true" />{rankNum}
        <span className="text-xs"> of {totalNum}</span>
      </span>
    );
  }

  return (
    <div className="bg-slate-700/30 border border-slate-700 rounded-lg p-4 flex flex-col justify-between shadow-md hover:shadow-lg hover:border-slate-600 transition-all duration-200 min-h-[120px]">
      <div>
        <div className="flex items-center text-sm font-medium text-blue-300/80 mb-2">
          {/* Render icon if provided */}
          {IconComponent && <IconComponent className="h-5 w-5 mr-2 flex-shrink-0" aria-hidden="true" />}
          <h4 className="truncate" title={label}>{label}</h4>
        </div>

        {/* Special rendering for topGenres */}
        {id === 'topGenres' && Array.isArray(value) ? (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {value.map(({ genre, count }) => (
               <span key={genre} className="px-3 py-1 bg-slate-700 text-blue-300 text-xs font-medium rounded-full shadow-sm whitespace-nowrap">
                   {genre} <span className="text-slate-400 text-[11px]">({count})</span>
               </span>
             ))}
          </div>
        ) : (
          // Default rendering for other value types
          <p className={`text-2xl xl:text-3xl font-semibold ${valueClassName} break-words`}>
            {value as any} {/* Render the value directly */}
            {rankDisplay} {/* Append the formatted rank */}
          </p>
        )}
      </div>
      {/* Render description if provided */}
      {description && (
        <p className="text-xs text-slate-400/80 mt-2">
          {description}
        </p>
      )}
    </div>
  );
};

export default ProfileStatCard;