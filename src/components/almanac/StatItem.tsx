import React from 'react';

interface StatItemProps {
    label: string;
    value: string | number;
    valueClassName?: string;
    tooltip?: string;
}

const StatItem: React.FC<StatItemProps> = ({
    label,
    value,
    valueClassName = "text-slate-100 font-medium",
    tooltip
}) => {
    return (
        <div className="flex justify-between items-center" title={tooltip}>
            <span className="text-slate-400">{label}:</span>
            <span className={valueClassName}>{value}</span>
        </div>
    );
};

export default StatItem;