import classNames from 'classnames';
import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { ACCENT_RAIL, type CardAccent } from './accents';
import Button from './Button';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useModalPresence } from '../../hooks/useModalPresence';

/** Anything that can take focus inside the panel, for the tab trap. */
const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'iframe',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** The dialog's heading. Also names the dialog for screen readers. */
    title: React.ReactNode;
    /** Small caps label above the title, saying what kind of thing this is. */
    eyebrow?: string;
    /** Quiet line under the title. */
    subtitle?: React.ReactNode;
    /**
     * Truncate the title to one line. Right for a name or a film title, wrong
     * for a heading written as a sentence.
     */
    truncateTitle?: boolean;
    /** Rail color, from the same semantic set the cards use. */
    accent?: CardAccent;
    /**
     * Inert art spanning the panel and clipped to its corners — a still wash, a
     * portrait. Sits under the content, above the panel fill. Mirrors
     * AccentCard's slot of the same name.
     */
    decoration?: React.ReactNode;
    /** Panel classes. Width and height constraints belong here. */
    className?: string;
    children: React.ReactNode;
}

/**
 * The app's dialog shell: scrim, panel, header, and the behavior every modal
 * needs — scroll lock, Escape, a focus trap that restores focus on close, and a
 * portal to `document.body`.
 *
 * The panel is built the way the cards are (see AccentCard): a light border and
 * an accent rail, not a drop shadow. On a dark UI a black shadow over a dark
 * scrim over a near-black page is invisible, and a panel whose edge you can't
 * find reads as flat no matter how much elevation the shadow claims. The white
 * hairline along the top edge is the light catch that makes it look raised.
 *
 * Portalling is load-bearing rather than tidiness: callers render modals deep
 * inside pages and rows that clip to their own rounded corners, and an ancestor
 * with a `transform` becomes the containing block for `position: fixed`
 * descendants — which is why the route transition in index.css has to use a
 * `backwards` fill. Leaving the body is how a dialog stops caring about any of
 * that.
 */
const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    eyebrow,
    subtitle,
    truncateTitle = true,
    accent = 'blue',
    decoration,
    className,
    children,
}) => {
    const { isRendered, isClosing } = useModalPresence(isOpen);
    const panelRef = useRef<HTMLDivElement>(null);
    const titleId = useId();

    // Held in a ref so the focus effect below can depend on `isOpen` alone.
    // Callers pass inline arrows, so depending on `onClose` itself would re-run
    // the effect on every render — stealing focus back to the panel each time.
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    // Stays locked through the close animation so the page doesn't jump early.
    useBodyScrollLock(isRendered);

    useEffect(() => {
        if (!isOpen) return;

        const previouslyFocused = document.activeElement as HTMLElement | null;
        panelRef.current?.focus();

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onCloseRef.current();
                return;
            }
            if (e.key !== 'Tab') return;

            // Keep tabbing inside the dialog: wrap at both ends rather than
            // letting focus walk out into the page behind the scrim.
            const panel = panelRef.current;
            if (!panel) return;
            const items = Array.from(
                panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
            ).filter((el) => el.offsetParent !== null || el === document.activeElement);
            if (items.length === 0) {
                e.preventDefault();
                panel.focus();
                return;
            }
            const first = items[0];
            const last = items[items.length - 1];
            const active = document.activeElement;
            if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
            } else if (e.shiftKey && (active === first || active === panel)) {
                e.preventDefault();
                last.focus();
            }
        };

        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            previouslyFocused?.focus?.();
        };
    }, [isOpen]);

    // Only a press that both started and ended on the scrim closes the dialog,
    // so dragging a selection out of the body text doesn't dismiss it.
    const pressedOnOverlay = useRef(false);

    if (!isRendered) return null;

    return createPortal(
        <div
            className={classNames(
                'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-[3px]',
                isClosing
                    ? 'animate-modal-backdrop-out pointer-events-none'
                    : 'animate-modal-backdrop-in'
            )}
            // React events travel the React tree, not the DOM tree, so a portal
            // does nothing to stop a click inside the dialog from reaching the
            // row or cell that rendered it. These do.
            onMouseDown={(e) => {
                e.stopPropagation();
                pressedOnOverlay.current = e.target === e.currentTarget;
            }}
            onClick={(e) => {
                e.stopPropagation();
                if (e.target === e.currentTarget && pressedOnOverlay.current) onClose();
            }}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                className={classNames(
                    'relative flex w-full flex-col overflow-hidden rounded-xl border border-slate-700/60',
                    'bg-slate-900/95 text-slate-200 shadow-2xl shadow-black/60 ring-1 ring-white/[0.06] outline-none',
                    isClosing ? 'animate-modal-panel-out' : 'animate-modal-panel-in',
                    className
                )}
            >
                {decoration && (
                    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
                        {decoration}
                    </div>
                )}

                {/* The lit top edge and the accent rail, above the decoration so
                    art washed into the panel can't bury them. */}
                <span className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                <span
                    className={classNames(
                        'pointer-events-none absolute inset-y-0 left-0 z-20 w-0.5',
                        ACCENT_RAIL[accent]
                    )}
                />

                <div className="relative z-10 flex flex-shrink-0 items-start justify-between gap-3 border-b border-slate-700/60 px-4 py-3.5 md:px-5 md:py-4">
                    <div className="min-w-0">
                        {eyebrow && (
                            <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
                                {eyebrow}
                            </p>
                        )}
                        {/* Merriweather ships 400 and 700 only, and
                            `font-synthesis: none` means anything between is a
                            lie — so the serif title carries its weight through
                            size and color instead. */}
                        <h2
                            id={titleId}
                            className={classNames(
                                'font-serif text-base leading-snug text-slate-100 md:text-lg',
                                truncateTitle && 'truncate'
                            )}
                        >
                            {title}
                        </h2>
                        {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
                    </div>
                    <Button
                        onClick={onClose}
                        variant="ghost"
                        className="-mr-1 flex-shrink-0"
                        aria-label="Close"
                    >
                        <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                    </Button>
                </div>

                <div className="relative z-10 flex min-h-0 flex-1 flex-col">{children}</div>
            </div>
        </div>,
        document.body
    );
};

export default Modal;
