import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { YouTubeSoundtrack, type SoundtrackStatus } from '../utils/youtubePlayer';

export interface SoundtrackHandle {
    /** Goes on the dock's `<iframe>`. */
    frameRef: React.RefObject<HTMLIFrameElement | null>;
    /** Goes on the iframe's `onLoad`: starts the handshake. */
    onFrameLoad: () => void;
    status: SoundtrackStatus;
    muted: boolean;
    /** Which video in the dock's queue is on, from 0. */
    playlistIndex: number;
    start: () => void;
    stop: () => void;
    pause: () => void;
    resume: () => void;
    setMuted: (muted: boolean) => void;
    /** Call when the iframe is pointed at a different track. */
    reset: () => void;
}

/**
 * A YouTube soundtrack bound to one iframe for the life of the component. The
 * window's `message` events are fed to it from here, filtered to that iframe.
 */
export function useSoundtrack(): SoundtrackHandle {
    const frameRef = useRef<HTMLIFrameElement | null>(null);
    const track = useMemo(
        () => new YouTubeSoundtrack(() => frameRef.current?.contentWindow ?? null),
        []
    );

    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            if (frameRef.current && event.source !== frameRef.current.contentWindow) return;
            track.receive(event.origin, event.data);
        };
        window.addEventListener('message', onMessage);
        return () => {
            window.removeEventListener('message', onMessage);
            track.dispose();
        };
    }, [track]);

    const subscribe = useCallback((listener: () => void) => track.subscribe(listener), [track]);
    const status = useSyncExternalStore(subscribe, () => track.status);
    const muted = useSyncExternalStore(subscribe, () => track.muted);
    const playlistIndex = useSyncExternalStore(subscribe, () => track.playlistIndex);

    return {
        frameRef,
        onFrameLoad: useCallback(() => track.connect(), [track]),
        status,
        muted,
        playlistIndex,
        start: useCallback(() => track.start(), [track]),
        stop: useCallback(() => track.stop(), [track]),
        pause: useCallback(() => track.pause(), [track]),
        resume: useCallback(() => track.resume(), [track]),
        setMuted: useCallback((m: boolean) => track.setMuted(m), [track]),
        reset: useCallback(() => track.reset(), [track]),
    };
}
