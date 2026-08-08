import { useEffect, useState } from 'react';

/**
 * Duration of the modal enter/exit animations defined in `index.css`, in ms.
 * Keep this in sync with the `.animate-fadeIn` / `.animate-fadeOut` timings.
 */
export const MODAL_ANIMATION_MS = 200;

interface ModalPresence {
  isRendered: boolean; // keep the modal in the tree (open, or animating out)
  isClosing: boolean;  // the exit animation is currently running
}

/**
 * Keeps a modal mounted for the length of its exit animation after `isOpen`
 * flips to false, so it can fade/scale out instead of blinking away. Callers
 * render while `isRendered` is true and swap in the "out" animation classes
 * while `isClosing` is true.
 */
export function useModalPresence(isOpen: boolean, durationMs = MODAL_ANIMATION_MS): ModalPresence {
  const [isRendered, setIsRendered] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      return;
    }
    // Unmount only once the exit animation has had time to play. Reopening
    // mid-close clears the timer, so the modal animates back in from where it is.
    const timer = window.setTimeout(() => setIsRendered(false), durationMs);
    return () => window.clearTimeout(timer);
  }, [isOpen, durationMs]);

  return { isRendered, isClosing: isRendered && !isOpen };
}
