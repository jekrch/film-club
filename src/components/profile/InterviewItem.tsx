import React from 'react';
import CollapsibleContent from '../common/CollapsableContent';
import Markdown from 'react-markdown';

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

  return (
    <div className="py-5">
      <h4 className="text-lg font-semiboldx text-blue-400 mb-2">{question}</h4>
      <div className={`prose prose-sm prose-invert max-w-none text-slate-300`}>
        <CollapsibleContent
          lineClamp={4}
          buttonSize='sm'
          className="ml-2 !italic"
        >
          <Markdown>
          {answer}
          </Markdown>
        </CollapsibleContent>
      </div> 

    </div>
  );
};

export default InterviewItem;