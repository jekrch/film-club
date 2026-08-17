import React, { useState } from 'react';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import Modal from '../common/Modal';

/**
 * Known meanings for a score qualifier letter. A qualifier marks a score that a
 * member considers only comprehensible within a particular medium/context, so
 * comparing it against an ordinary score would be a category mistake.
 */
const QUALIFIER_MEANINGS: Record<string, string> = {
    d: 'documentary',
};

interface ScoreQualifierNoteProps {
    user: string; // the member who gave the qualified score (e.g. "joey")
    qualifier: string; // the trailing letter from the sheet (e.g. "d")
}

const capitalize = (str: string): string =>
    str ? str.charAt(0).toUpperCase() + str.slice(1) : str;

/**
 * Renders a qualified club score's trailing letter (e.g. the "d" in Joey's
 * "7.5d") followed by a very small, subtle "?" icon. Clicking the icon opens a
 * playful note explaining why the qualified score can't be compared against
 * ordinary scores — the "category mistake" disclaimer. The letter + icon are
 * inline so they don't disturb the surrounding layout or column alignment.
 */
const ScoreQualifierNote: React.FC<ScoreQualifierNoteProps> = ({ user, qualifier }) => {
    const [isOpen, setIsOpen] = useState(false);
    const letter = qualifier.toLowerCase();
    const medium = QUALIFIER_MEANINGS[letter] ?? 'the relevant';
    const name = capitalize(user);

    return (
        <>
            {/* The qualifier letter reads as part of the score (e.g. "7.5d"). */}
            <span className="text-amber-200">{letter}</span>
            {/* Very small, subtle clickable info affordance — sized in em so it scales
          with the score text and stays a tiny superscript rather than a button. */}
            <QuestionMarkCircleIcon
                role="button"
                tabIndex={0}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsOpen(true);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setIsOpen(true);
                    }
                }}
                aria-label={`Why is there a "${letter}" on ${name}'s score?`}
                className="inline-block ml-px h-[0.75em] w-[0.75em] align-super cursor-pointer text-slate-300 hover:text-amber-300 transition-colors focus:outline-none focus:text-amber-300"
            />

            <Modal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                // Amber is the qualifier accent throughout — the letter in the
                // score, the word in the copy, and now the panel's own rail.
                accent="amber"
                eyebrow="Qualified score"
                title={
                    <>
                        What the heck is that <span className="text-amber-400">{letter}</span> doing
                        there?
                    </>
                }
                truncateTitle={false}
                className="max-w-md"
                decoration={
                    <>
                        {/* Faded portrait of the member whose score this is, washing in
                            from the right and fading out toward the text. */}
                        <img
                            src={`/images/${user.toLowerCase()}.jpg`}
                            alt=""
                            aria-hidden="true"
                            className="absolute right-0 top-0 h-full w-2/3 object-cover object-top opacity-[0.14]"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 from-40% via-slate-900/95 to-slate-900/10" />
                    </>
                }
            >
                <div className="p-4 md:p-5 space-y-3 text-sm leading-relaxed text-slate-300">
                    <p>
                        Good question! That little{' '}
                        <span className="font-semibold text-amber-400">{letter}</span> is {name}'s{' '}
                        {medium} qualifier. For {name}, a {medium} score is only comprehensible when
                        understood in the context of the {medium} medium.
                    </p>
                    <p>
                        Attempting to place a {medium} score alongside a score for an ordinary film
                        amounts to a category mistake: like ranking the flavor of a given root beer
                        against the ball-handling skills of a young Michael Jordan.
                    </p>
                    <p>
                        To avoid any typological confusion, he has asked that you reflect on this
                        important qualification when you consider his score.
                    </p>
                </div>
            </Modal>
        </>
    );
};

export default ScoreQualifierNote;
