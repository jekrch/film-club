import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CardSize } from '../../contexts/ViewSettingsContext';

interface AllFilmsCardProps {
    cardSize: CardSize;
}

const AllFilmsCard: React.FC<AllFilmsCardProps> = ({ cardSize }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const isCompact = cardSize === 'compact';
    const isPosterOnly = cardSize === 'poster';

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => setIsVisible(entry.isIntersecting),
            { 
                threshold: 0.1,
                rootMargin: '50px'
            }
        );
        
        const currentRef = cardRef.current;
        if (currentRef) {
            observer.observe(currentRef);
            
            // Check initial visibility
            const rect = currentRef.getBoundingClientRect();
            const isInitiallyVisible = (
                rect.top < window.innerHeight &&
                rect.bottom > 0 &&
                rect.left < window.innerWidth &&
                rect.right > 0
            );
            
            if (isInitiallyVisible) {
                setIsVisible(true);
            }
        }
        
        return () => { 
            if (currentRef) observer.unobserve(currentRef);
        };
    }, []);

    return (
        <div
            ref={cardRef}
            className={`
                transition-opacity duration-500 ease-out
                ${isVisible ? 'opacity-100' : 'opacity-30'}
                relative group rounded-md overflow-hidden
            `}
        >
            <Link
                to="/films"
                aria-label="View all films"
                title="View all films"
                className="block h-full"
            >
                <div className={`
                    bg-slate-700/50 overflow-hidden h-full flex flex-col
                    border border-slate-700 rounded-md
                    shadow-xl hover:shadow-2xl shadow-black/50
                    transition-all duration-300 ease-in-out
                    ${isPosterOnly ? 'border-slate-800' : ''}
                `}>
                    {/* Icon area matching poster aspect ratio */}
                    <div 
                        className={`relative w-full overflow-hidden ${isPosterOnly ? 'rounded-md' : 'rounded-t-md'}`} 
                        style={{ paddingBottom: '140%' }} // Match FilmCard poster aspect ratio
                    >
                        <div className="absolute inset-0 bg-slate-800/50 hover:bg-slate-700/50 transition-colors duration-300 flex items-center justify-center">
                            {/* Arrow icon */}
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className={`
                                    transition-all duration-300 ease-in-out
                                    text-slate-400 group-hover:text-blue-400
                                    group-hover:scale-110
                                    ${isPosterOnly ? 'h-16 w-16' : isCompact ? 'h-12 w-12' : 'h-16 w-16'}
                                `}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={1.5}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25 21 12m0 0-3.75 3.75M21 12H3" />
                            </svg>
                        </div>
                    </div>

                    {/* Content area - only show if NOT in poster mode */}
                    {!isPosterOnly && (
                        <div className={`
                            flex flex-col flex-grow items-center justify-center text-center
                            ${isCompact ? 'p-2 pt-3 pb-3' : 'p-4 pt-5 pb-5'}
                            bg-gradient-to-b from-slate-800 to-[#27364f] rounded-b-md
                        `}>
                            <h3 className={`
                                font-normal text-slate-200 group-hover:text-blue-400
                                transition-colors duration-200
                                ${isCompact ? 'text-sm leading-tight' : 'text-base'}
                            `}>
                                View All Films
                            </h3>
                            {!isCompact && (
                                <p className="text-xs text-slate-400 mt-1 group-hover:text-slate-300 transition-colors duration-200">
                                    Browse the collection
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </Link>
        </div>
    );
};

export default AllFilmsCard;