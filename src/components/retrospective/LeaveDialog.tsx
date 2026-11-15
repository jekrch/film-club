import React, { useEffect, useId, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface LeaveDialogProps {
    /** Open while a link out of the deck is waiting on the reader's say-so. */
    open: boolean;
    onStay: () => void;
    onLeave: () => void;
    accent: string;
    /** Snaps rather than animates, for reduced motion. */
    still: boolean;
}

/**
 * Asked before a link in a slide takes the reader out of the retrospective:
 * staying is the default, and the one Escape and the scrim choose.
 *
 * Drawn by the deck itself rather than the app's Modal, which sits below the
 * deck's layer. It carries `data-deck-dialog` so the deck's tap-to-advance
 * leaves presses on it alone.
 */
const LeaveDialog: React.FC<LeaveDialogProps> = ({ open, onStay, onLeave, accent, still }) => {
    const titleId = useId();
    const stayRef = useRef<HTMLButtonElement>(null);
    const leaveRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!open) return;
        const previouslyFocused = document.activeElement as HTMLElement | null;
        stayRef.current?.focus();
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onStay();
            } else if (event.key === 'Tab') {
                // Two buttons: Tab goes back and forth between them.
                event.preventDefault();
                (document.activeElement === stayRef.current ? leaveRef : stayRef).current?.focus();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            previouslyFocused?.focus?.();
        };
    }, [open, onStay]);

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    data-deck-dialog
                    className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
                    initial={still ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: still ? 0 : 0.2, ease: 'easeOut' }}
                    onClick={(event) => {
                        if (event.target === event.currentTarget) onStay();
                    }}
                >
                    <motion.div
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                        className="w-full max-w-sm rounded-2xl bg-slate-900/95 p-6 text-center shadow-2xl shadow-black/60 ring-1 ring-slate-100/10"
                        initial={still ? false : { opacity: 0, scale: 0.96, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: still ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <h2 id={titleId} className="font-serif text-xl text-slate-50">
                            Leave the retrospective?
                        </h2>
                        <p className="mt-2 text-sm leading-relaxed text-slate-400">
                            Your browser&rsquo;s back button will bring you back to this slide.
                        </p>
                        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
                            <button
                                ref={leaveRef}
                                type="button"
                                onClick={onLeave}
                                className="flex-1 rounded-full px-5 py-2.5 text-sm font-medium text-slate-300 ring-1 ring-slate-100/15 transition-colors hover:bg-slate-100/5 hover:text-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-100/50"
                            >
                                Leave
                            </button>
                            <button
                                ref={stayRef}
                                type="button"
                                onClick={onStay}
                                className="flex-1 rounded-full px-5 py-2.5 text-sm font-semibold text-page shadow-lg transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-100/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                                style={{ backgroundColor: accent }}
                            >
                                Keep watching
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default LeaveDialog;
