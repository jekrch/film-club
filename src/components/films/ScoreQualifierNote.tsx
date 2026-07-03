import React, { useEffect, useState } from 'react';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

/**
 * Known meanings for a score qualifier letter. A qualifier marks a score that a
 * member considers only comprehensible within a particular medium/context, so
 * comparing it against an ordinary score would be a category mistake.
 */
const QUALIFIER_MEANINGS: Record<string, string> = {
  d: 'documentary',
};

interface ScoreQualifierNoteProps {
  user: string;      // the member who gave the qualified score (e.g. "joey")
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

  useBodyScrollLock(isOpen);

  // Close on Escape while the note is open.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  return (
    <>
      {/* The qualifier letter reads as part of the score (e.g. "7.5d"). */}
      <span className="text-amber-200">{letter}</span>
      {/* Very small, subtle clickable info affordance — sized in em so it scales
          with the score text and stays a tiny superscript rather than a button. */}
      <QuestionMarkCircleIcon
        role="button"
        tabIndex={0}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(true); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsOpen(true); } }}
        aria-label={`Why is there a "${letter}" on ${name}'s score?`}
        className="inline-block ml-px h-[0.75em] w-[0.75em] align-super cursor-pointer text-slate-300 hover:text-amber-300 transition-colors focus:outline-none focus:text-amber-300"
      />

      {isOpen && (
        // `whitespace-normal` / `text-left` reset the inherited `whitespace-nowrap`
        // and any right-alignment from the score cell this note renders inside, so
        // the modal copy wraps normally.
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-fadeIn whitespace-normal text-left"
          onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
        >
          <div
            className="relative bg-slate-800 text-slate-200 rounded-lg shadow-2xl max-w-md w-full animate-scaleIn overflow-hidden border border-slate-700/60"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Faded portrait of the member whose score this is, washing in from
                the right and fading out toward the text — mirrors CreditsModal. */}
            <img
              src={`/images/${user.toLowerCase()}.jpg`}
              alt=""
              aria-hidden="true"
              className="absolute right-0 top-0 h-full w-2/3 object-cover object-top pointer-events-none opacity-10"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-800 from-40% via-slate-800/95 to-slate-800/10 pointer-events-none" />

            <div className="relative z-10 flex justify-between items-center p-4 md:p-5 border-b border-slate-700/60">
              <h2 className="text-base md:text-lg font-semibold text-slate-100 pr-4">
                What the heck is that <span className="text-amber-400">{letter}</span> doing there?
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-100 transition-colors rounded-full p-1.5 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 flex-shrink-0"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="relative z-10 p-4 md:p-5 space-y-3 text-sm leading-relaxed text-slate-300">
              <p>
                Good question! That little <span className="font-semibold text-amber-400">{letter}</span> is{' '}
                {name}'s {medium} qualifier. For {name}, a {medium} score is only comprehensible
                when understood in the context of the {medium} medium.
              </p>
              <p>
                Attempting to place a {medium} score alongside a score for an ordinary film amounts
                to a category mistake: like ranking the flavor of a given root beer against the
                ball-handling skills of a young Michael Jordan.
              </p>
              <p>
                To avoid any typological confusion, he has asked that you reflect on this important
                qualification when you consider his score.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ScoreQualifierNote;
