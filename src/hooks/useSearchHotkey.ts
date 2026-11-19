import { useEffect } from 'react';

/** Whether this is a Mac, for printing ⌘ rather than Ctrl in shortcut hints. */
export const isApplePlatform = (): boolean => {
    if (typeof navigator === 'undefined') return false;
    const platform =
        (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
            ?.platform ?? navigator.platform;
    return /mac|iphone|ipad|ipod/i.test(platform ?? '');
};

/**
 * ⌘K (Ctrl+K elsewhere) toggles the site-wide search from anywhere, the chord
 * most sites with a command palette have settled on.
 *
 * Taken over even from inside a text field, which is what makes it a chord
 * worth learning: the browser's own Ctrl+K (focus the address bar's search)
 * is the one thing given up for it.
 */
export const useSearchHotkey = (onToggle: () => void): void => {
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() !== 'k' || event.altKey || event.shiftKey) return;
            if (!(event.metaKey || event.ctrlKey)) return;
            event.preventDefault();
            onToggle();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onToggle]);
};
