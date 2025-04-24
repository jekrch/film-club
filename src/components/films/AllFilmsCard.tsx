import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CardSize } from '../../contexts/ViewSettingsContext'; // Assuming context exists

interface AllFilmsCardProps {
    cardSize: CardSize;
}

const AllFilmsCard: React.FC<AllFilmsCardProps> = ({ cardSize }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const isCompact = cardSize === 'compact';

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => setIsVisible(entry.isIntersecting),
            { threshold: 0.1 }
        );
        const currentRef = cardRef.current;
        if (currentRef) observer.observe(currentRef);
        return () => { if (currentRef) observer.unobserve(currentRef) };
    }, []);

    return (
        <div
            ref={cardRef}
            className={`
                transition-opacity duration-500 ease-out
                ${isVisible ? 'opacity-100' : 'opacity-30'}
                relative group h-full // Ensure it takes full height like other cards
            `}
            style={{ minHeight: isCompact ? '200px' : '350px' }} // Optional: Set min-height if needed
        >
            <Link
                to="/films" // Link to the main films list page
                aria-label="View all films"
                title="View all films"
                className="block h-full"
            >
                <div className={`
                    bg-slate-700 overflow-hidden h-full flex flex-col // Flex column layout
                    border border-slate-700 group-hover:border-slate-500 // Slightly lighter border on hover
                    transition-all duration-300 ease-in-out
                    shadow-md group-hover:shadow-lg shadow-slate-900/30
                    group-hover:bg-slate-650 // Subtle background change on hover
                    ${isCompact ? 'rounded-md' : 'rounded-lg'}
                `}>
                    {/* Placeholder area mimicking poster aspect ratio */}
                    <div className={`
                        relative pb-[150%] overflow-hidden // Maintain aspect ratio
                        flex items-center justify-center // Center the icon
                        bg-slate-800/50 group-hover:bg-slate-700/50 // Background for the icon area
                        transition-colors duration-300
                    `}>
                        {/* Icon - Example: Arrow Right */}
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className={`
                                absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 // Center precisely
                                transition-all duration-300 ease-in-out
                                text-slate-400 group-hover:text-blue-400 // Change color on hover
                                group-hover:scale-110 // Scale icon slightly on hover
                                ${isCompact ? 'h-12 w-12' : 'h-16 w-16'} // Size based on cardSize
                            `}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5} // Slightly thinner stroke
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25 21 12m0 0-3.75 3.75M21 12H3" />
                        </svg>

                        {/* Alternative Icon: Plus Sign
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className={` ... similar classes ... ${isCompact ? 'h-14 w-14' : 'h-20 w-20'}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        */}
                    </div>

                    {/* Content area */}
                    <div className={`
                        flex flex-col flex-grow items-center justify-center text-center // Center text content
                        ${isCompact ? 'p-2 pt-3 pb-3' : 'p-4 pt-5 pb-5'} // Adjust padding
                    `}>
                        <h3 className={`
                            font-semibold text-slate-100 group-hover:text-blue-400 // Match title hover
                            transition-colors duration-200
                            ${isCompact ? 'text-sm leading-tight' : 'text-base md:text-lg'}
                        `}>
                            View All Films
                        </h3>
                        {/* Optional: Add a subtle description */}
                        {!isCompact && (
                            <p className="text-xs text-slate-400 mt-1 group-hover:text-slate-300 transition-colors duration-200">
                                Browse the collection
                            </p>
                        )}
                    </div>
                </div>
            </Link>
        </div>
    );
};

export default AllFilmsCard;