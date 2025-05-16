import React, { useState, useRef, useLayoutEffect } from 'react';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

interface CollapsibleContentProps {
  children: React.ReactNode;
  lineClamp?: number; // Number of lines to clamp to
  buttonTexts?: { more: string; less: string };
  className?: string; // For the content wrapper
  buttonClassName?: string;
  buttonSize?: 'sm' | 'md'; 
}

const CollapsibleContent: React.FC<CollapsibleContentProps> = ({
  children,
  buttonSize,
  lineClamp = 3,
  buttonTexts = { more: 'Read More', less: 'Read Less' },
  className = '',
  buttonClassName = 'not-italic text-blue-400 hover:text-blue-300 text-sm font-medium mt-2 inline-flex items-center'
}) => {

  if (buttonSize === 'sm') {
    buttonClassName += ' !px-3 !py-2 text-blue-400 hover:text-blue-300 !text-xs font-medium mt-3';
  }
  const [isExpanded, setIsExpanded] = useState(false);
  const [isActuallyOverflowing, setIsActuallyOverflowing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = contentRef.current;
    if (element) {
      if (!isExpanded) {
        const isClamped = element.scrollHeight > element.clientHeight;
        setIsActuallyOverflowing(isClamped);
      } else {
        setIsActuallyOverflowing(false); // When expanded, it's not considered "overflowing" in clamped sense
      }
    }
  }, [children, isExpanded, lineClamp]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const showButton = isExpanded || isActuallyOverflowing;

  return (
    <div className={className}>
      <div
        ref={contentRef}
        className={`${!isExpanded && lineClamp ? `line-clamp-${lineClamp}` : ''}`}
        style={!isExpanded && lineClamp ? { WebkitLineClamp: lineClamp, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {}}
      >
        {children}
      </div>
      {showButton && (
        <button onClick={toggleExpanded} className={buttonClassName} aria-expanded={isExpanded}>
          {isExpanded ? buttonTexts.less : buttonTexts.more}
          {isExpanded ? <ChevronUpIcon className="h-4 w-4 ml-1" /> : <ChevronDownIcon className="h-4 w-4 ml-1" />}
        </button>
      )}
    </div>
  );
};

export default CollapsibleContent;