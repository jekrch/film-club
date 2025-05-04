import React from 'react';

interface ChartContainerProps {
    children: React.ReactNode;
    className?: string;
}

const ChartContainer: React.FC<ChartContainerProps> = ({
    children,
    className = "bg-slate-800 bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg p-3 sm:p-4 md:p-5 shadow-xl border border-slate-600 mb-4"
}) => {
    return (
        <div className={className}>
            {children}
        </div>
    );
};

export default ChartContainer;