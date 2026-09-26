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
    /** Who is answering, set in the margin beside the answer. */
    speaker: string;
}

// Speaker labels sit in a margin column, the way a printed interview marks
// who is talking. On narrow screens the margin would eat the text, so the
// label moves above its line instead.
const ROW = 'sm:grid sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:gap-x-4';
const SPEAKER =
    'mb-1 block truncate text-[11px] font-medium uppercase tracking-[0.14em] sm:mb-0 sm:pt-[0.2rem]';

/**
 * One exchange from a member's interview, set like a print transcript: the
 * question in sans, the answer in serif, each marked with its speaker. Long
 * answers clamp with a toggle.
 */
const InterviewItem: React.FC<InterviewItemProps> = ({ question, answer, speaker }) => {
    return (
        <div className="space-y-3 py-6">
            <div className={ROW}>
                <span className={`${SPEAKER} text-slate-500`} aria-hidden="true">
                    Q.
                </span>
                <h4 className="text-[15px] font-medium leading-snug text-slate-100">{question}</h4>
            </div>
            <div className={ROW}>
                <span className={`${SPEAKER} text-blue-300/70`} title={speaker}>
                    {speaker}
                </span>
                <CollapsibleContent
                    lineClamp={5}
                    buttonSize="sm"
                    buttonClassName="mt-2 font-sans"
                    className="prose prose-sm prose-invert max-w-none font-serif leading-relaxed text-slate-300 prose-p:my-0 [&_p+p]:mt-3"
                >
                    <Markdown>{answer}</Markdown>
                </CollapsibleContent>
            </div>
        </div>
    );
};

export default InterviewItem;
