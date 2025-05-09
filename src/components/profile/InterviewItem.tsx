import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

/**
 * Props for the InterviewItem component.
 */
interface InterviewItemProps {
  /** The interview question. */
  question: string;
  /** The interview answer (can contain Markdown). */
  answer: string;
}

/**
 * Displays a single interview question and answer, with expand/collapse functionality for long answers.
 */
const InterviewItem: React.FC<InterviewItemProps> = ({ question, answer }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  // Determine if the expander button is needed based on answer length
  const needsExpander = answer.length > 200;

  return (
    <div className="py-5">
      <h4 className="text-lg font-semiboldx text-blue-400 mb-2">{question}</h4>
      {/* Apply line clamp only if not expanded and expander is needed */}
      <div className={`prose prose-sm prose-invert max-w-none text-slate-300 ${!isExpanded && needsExpander ? 'line-clamp-4' : ''}`}>
        <ReactMarkdown>{answer}</ReactMarkdown>
      </div>
      {/* Show button only if expander is needed */}
      {needsExpander && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-blue-400 hover:text-blue-300 text-sm font-medium mt-2 inline-flex items-center"
          aria-expanded={isExpanded}
        >
          {isExpanded ? 'Read Less' : 'Read More'}
          {isExpanded ? <ChevronUpIcon className="h-4 w-4 ml-1" /> : <ChevronDownIcon className="h-4 w-4 ml-1" />}
        </button>
      )}
    </div>
  );
};

export default InterviewItem;