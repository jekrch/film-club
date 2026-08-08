import React from 'react';
import AccentCard, { CardAccent } from '../common/AccentCard';

interface ChartContainerProps {
    children: React.ReactNode;
    /** Spacing/layout classes only — the surface comes from AccentCard. */
    className?: string;
    accent?: CardAccent;
}

const ChartContainer: React.FC<ChartContainerProps> = ({
    children,
    className = "mb-4",
    accent = "blue",
}) => {
    return (
        <AccentCard accent={accent} className={`p-3 sm:p-4 md:p-5 ${className}`}>
            {children}
        </AccentCard>
    );
};

export default ChartContainer;
