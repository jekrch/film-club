import React from 'react';

interface StatCardProps {
    label: string;
    value: string | number;
    description?: string;
    valueClassName?: string;
    containerClassName?: string;
}

const StatCard: React.FC<StatCardProps> = ({
    label,
    value,
    description,
    valueClassName = "font-mono text-slate-100 tracking-tight text-lg sm:text-xl md:text-2xl",
    containerClassName = "bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg p-4 shadow-lg border border-slate-600"
}) => {
    return (
        <div className={containerClassName}>
            <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-1">{label}</p>
            <p className={valueClassName}>{value}</p>
            {description && (
                <p className="text-xs text-slate-400 mt-0.5">{description}</p>
            )}
        </div>
    );
};

export default StatCard;