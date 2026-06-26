import { useEffect } from 'react';

/**
 * Locks scrolling on the document body while `isLocked` is true (e.g. while a
 * modal is open), so content behind the overlay can't be scrolled. Restores the
 * previous overflow value on unlock/unmount, and reference-counts concurrent
 * locks so closing one modal doesn't release the lock held by another.
 */
let lockCount = 0;
let previousOverflow = '';

export function useBodyScrollLock(isLocked: boolean): void {
  useEffect(() => {
    if (!isLocked) return;

    if (lockCount === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    lockCount += 1;

    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        document.body.style.overflow = previousOverflow;
      }
    };
  }, [isLocked]);
}
