/**
 * A YouTube embed, driven from this page: the retrospective's soundtrack.
 *
 * The official IFrame API is a script from `youtube.com`, and `script-src` in
 * `vite.config.ts` is pinned so that no such origin is needed. That script is
 * only a wrapper around `postMessage` anyway, so this module speaks the same
 * messages to the same embed the trailers already use: `frame-src` allows
 * `youtube-nocookie.com`, and nothing else has to change.
 *
 * The protocol is what the official script sends and has been stable for a
 * decade, but it is not documented. Everything that depends on it is in this
 * file, so a change on YouTube's side is one file to fix — and the report never
 * depends on music to work. When playback can't start (Safari can refuse a
 * cross-origin play even after a tap), the status goes to `blocked` and the dock
 * shows the player's own controls, which always work.
 *
 * YouTube's terms forbid hiding the player or shrinking it below 200×200, and
 * forbid audio-only use; the dock that renders this is visible and at least
 * that size.
 */

export const YOUTUBE_ORIGIN = 'https://www.youtube-nocookie.com';

/** The id the official script tags its messages with; the embed echoes it back. */
const CHANNEL = { id: 1, channel: 'widget' };

/** What the embed reports as `playerState`. */
export type PlayerState = 'unstarted' | 'ended' | 'playing' | 'paused' | 'buffering' | 'cued';

const PLAYER_STATES: Record<number, PlayerState> = {
    [-1]: 'unstarted',
    0: 'ended',
    1: 'playing',
    2: 'paused',
    3: 'buffering',
    5: 'cued',
};

/**
 * The embed address for a soundtrack. `enablejsapi` and `origin` are what make
 * it answer `postMessage`. The player opens on `key` with each video in `then`
 * queued after it, which gives the player its own next and previous buttons;
 * `loop` wraps those round. Left to itself the player would also move on when
 * a video ends — {@link YouTubeSoundtrack} stops that, so each one repeats
 * until the reader skips. A single video loops only with a `playlist` of itself.
 */
export const soundtrackEmbedUrl = (key: string, pageOrigin: string, then?: string[]): string => {
    const params = new URLSearchParams({
        enablejsapi: '1',
        origin: pageOrigin,
        loop: '1',
        playlist: then?.length ? then.join(',') : key,
        playsinline: '1',
        rel: '0',
        iv_load_policy: '3',
    });
    return `${YOUTUBE_ORIGIN}/embed/${encodeURIComponent(key)}?${params}`;
};

export const commandMessage = (func: string, args: unknown[] = []): string =>
    JSON.stringify({ event: 'command', func, args, ...CHANNEL });

/** Asks the embed to start reporting its state. Sent until it does. */
export const listeningMessage = (): string => JSON.stringify({ event: 'listening', ...CHANNEL });

export interface PlayerUpdate {
    ready?: true;
    state?: PlayerState;
    volume?: number;
    muted?: boolean;
    /** Where in the queue the player is, from 0 for the video in the address. */
    playlistIndex?: number;
    /** Seconds into the current video, and how long it is. */
    currentTime?: number;
    duration?: number;
}

/**
 * One message from the embed, as the fields this page cares about, or null for
 * anything that isn't from YouTube or says nothing useful.
 */
export const parsePlayerMessage = (origin: string, data: unknown): PlayerUpdate | null => {
    if (origin !== YOUTUBE_ORIGIN) return null;

    let message: unknown = data;
    if (typeof data === 'string') {
        try {
            message = JSON.parse(data);
        } catch {
            return null;
        }
    }
    if (typeof message !== 'object' || message === null) return null;

    const { event, info } = message as { event?: unknown; info?: unknown };
    switch (event) {
        case 'onReady':
            return { ready: true };
        case 'onStateChange':
            return typeof info === 'number' && info in PLAYER_STATES
                ? { state: PLAYER_STATES[info] }
                : null;
        case 'initialDelivery':
        case 'infoDelivery': {
            if (typeof info !== 'object' || info === null) return null;
            const { playerState, volume, muted, playlistIndex, currentTime, duration } =
                info as Record<string, unknown>;
            const update: PlayerUpdate = {};
            if (typeof playerState === 'number' && playerState in PLAYER_STATES) {
                update.state = PLAYER_STATES[playerState];
            }
            if (typeof volume === 'number') update.volume = volume;
            if (typeof muted === 'boolean') update.muted = muted;
            if (typeof playlistIndex === 'number' && playlistIndex >= 0) {
                update.playlistIndex = playlistIndex;
            }
            if (typeof currentTime === 'number') update.currentTime = currentTime;
            if (typeof duration === 'number') update.duration = duration;
            return Object.keys(update).length ? update : null;
        }
        default:
            return null;
    }
};

// ---------------------------------------------------------------------------
// The soundtrack
// ---------------------------------------------------------------------------

/**
 * - `idle`: nothing asked of it yet.
 * - `starting`: asked to play, not yet heard that it is.
 * - `playing` / `paused`: as reported by the player.
 * - `blocked`: asked to play and it didn't; the reader has to tap the video.
 */
export type SoundtrackStatus = 'idle' | 'starting' | 'playing' | 'paused' | 'blocked';

/**
 * What the deck talks to, whatever is making the sound. One implementation
 * today; a hosted `<audio>` track would be a second, behind the same calls.
 */
export interface Soundtrack {
    readonly status: SoundtrackStatus;
    readonly muted: boolean;
    /** Call from inside a user gesture. Fades in. */
    start(): void;
    pause(): void;
    resume(): void;
    setMuted(muted: boolean): void;
    /** Fades out, then pauses. */
    stop(): void;
    /** Called on every change of {@link status} or {@link muted}. Returns the unsubscribe. */
    subscribe(listener: () => void): () => void;
    dispose(): void;
}

/** The timer functions the fades and handshake use, so a test can drive them. */
export interface Clock {
    setTimeout: (fn: () => void, ms: number) => unknown;
    clearTimeout: (handle: unknown) => void;
    setInterval: (fn: () => void, ms: number) => unknown;
    clearInterval: (handle: unknown) => void;
}

const realClock: Clock = {
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (handle) => window.clearTimeout(handle as number),
    setInterval: (fn, ms) => window.setInterval(fn, ms),
    clearInterval: (handle) => window.clearInterval(handle as number),
};

/** Where the music sits once it has faded in: present, under the slides. */
export const TARGET_VOLUME = 70;
export const FADE_IN_MS = 2000;
export const FADE_OUT_MS = 1500;
/** How long a play may take to report itself before the dock asks for a tap. */
export const BLOCKED_AFTER_MS = 1500;
const FADE_STEP_MS = 100;
/**
 * How close to the end of a video the player is sent back to its start. The
 * embed reports its time a few times a second, so this catches the end before
 * the player can move on to the next video.
 */
export const REWIND_BEFORE_END_S = 1;
const HANDSHAKE_EVERY_MS = 250;
const HANDSHAKE_TRIES = 40;

interface PostTarget {
    postMessage: (message: string, targetOrigin: string) => void;
}

export class YouTubeSoundtrack implements Soundtrack {
    status: SoundtrackStatus = 'idle';
    muted = false;
    /** Which video in the queue is on: changes only when the reader skips. */
    playlistIndex = 0;

    private ready = false;
    private queued: string[] = [];
    private listeners = new Set<() => void>();
    private fade: unknown = null;
    private blockedTimer: unknown = null;
    private handshake: unknown = null;
    private volume = 0;
    /** Set while `stop` is fading out, so the pause it ends with isn't mistaken for the reader's. */
    private stopping = false;
    private duration = 0;
    /** Set from sending a rewind until the player reports it has gone back. */
    private rewinding = false;

    constructor(
        /** The embed's window, once there is one. */
        private readonly target: () => PostTarget | null,
        private readonly clock: Clock = realClock
    ) {}

    /** Call when the iframe loads: asks the embed to report until it answers. */
    connect(): void {
        this.clock.clearInterval(this.handshake);
        let tries = 0;
        const ask = () => {
            if (this.ready || ++tries > HANDSHAKE_TRIES) {
                this.clock.clearInterval(this.handshake);
                return;
            }
            this.target()?.postMessage(listeningMessage(), YOUTUBE_ORIGIN);
        };
        ask();
        this.handshake = this.clock.setInterval(ask, HANDSHAKE_EVERY_MS);
    }

    /** Feed every `message` event on the window through here. */
    receive(origin: string, data: unknown): void {
        const update = parsePlayerMessage(origin, data);
        if (!update) return;

        if (update.ready && !this.ready) {
            this.ready = true;
            this.clock.clearInterval(this.handshake);
            this.queued.forEach((message) => this.target()?.postMessage(message, YOUTUBE_ORIGIN));
            this.queued = [];
        }
        if (update.muted !== undefined && update.muted !== this.muted) {
            this.muted = update.muted;
            this.emit();
        }
        if (update.playlistIndex !== undefined && update.playlistIndex !== this.playlistIndex) {
            this.playlistIndex = update.playlistIndex;
            this.duration = 0;
            this.rewinding = false;
            this.emit();
        }
        if (update.duration !== undefined) this.duration = update.duration;
        if (update.currentTime !== undefined) this.repeatNearEnd(update.currentTime);

        if (update.state === 'ended' && !this.stopping) {
            // Missed the end by time: the player may already be moving on, so
            // put it back on the video that finished.
            this.send('playVideoAt', [this.playlistIndex]);
            return;
        }

        if (update.state === 'playing') {
            this.clock.clearTimeout(this.blockedTimer);
            if (this.status === 'starting' || this.status === 'blocked') {
                this.fadeTo(TARGET_VOLUME, FADE_IN_MS);
            }
            this.setStatus('playing');
        } else if (update.state === 'paused') {
            if (this.status === 'playing' && !this.stopping) this.setStatus('paused');
        }
    }

    start(): void {
        this.clock.clearTimeout(this.blockedTimer);
        this.setStatus('starting');
        this.volume = 0;
        this.send('setVolume', [0]);
        if (!this.muted) this.send('unMute');
        this.send('playVideo');
        this.blockedTimer = this.clock.setTimeout(() => {
            if (this.status === 'starting') this.setStatus('blocked');
        }, BLOCKED_AFTER_MS);
    }

    pause(): void {
        this.send('pauseVideo');
        if (this.status === 'playing') this.setStatus('paused');
    }

    resume(): void {
        this.send('playVideo');
    }

    setMuted(muted: boolean): void {
        this.muted = muted;
        this.send(muted ? 'mute' : 'unMute');
        this.emit();
    }

    stop(): void {
        this.clock.clearTimeout(this.blockedTimer);
        if (this.status !== 'playing') {
            this.send('pauseVideo');
            this.setStatus(this.status === 'idle' ? 'idle' : 'paused');
            return;
        }
        this.stopping = true;
        this.fadeTo(0, FADE_OUT_MS, () => {
            this.send('pauseVideo');
            this.stopping = false;
            this.setStatus('paused');
        });
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Forgets the embed it was talking to: call when the iframe is pointed at a
     * different video, before it loads. Nothing sent to the old player carries
     * over, and the new one is asked to listen once it loads ({@link connect}).
     */
    reset(): void {
        this.clock.clearInterval(this.fade);
        this.clock.clearInterval(this.handshake);
        this.clock.clearTimeout(this.blockedTimer);
        this.ready = false;
        this.queued = [];
        this.volume = 0;
        this.stopping = false;
        this.duration = 0;
        this.rewinding = false;
        if (this.playlistIndex !== 0) {
            this.playlistIndex = 0;
            this.emit();
        }
        this.setStatus('idle');
    }

    dispose(): void {
        this.clock.clearInterval(this.fade);
        this.clock.clearInterval(this.handshake);
        this.clock.clearTimeout(this.blockedTimer);
        this.listeners.clear();
    }

    /** Sends now if the embed is listening, or as soon as it is. */
    private send(func: string, args: unknown[] = []): void {
        const message = commandMessage(func, args);
        if (this.ready) this.target()?.postMessage(message, YOUTUBE_ORIGIN);
        else this.queued.push(message);
    }

    /** Sends the player back to the start of a video that is about to end. */
    private repeatNearEnd(currentTime: number): void {
        if (this.duration <= REWIND_BEFORE_END_S) return;
        const nearEnd = currentTime >= this.duration - REWIND_BEFORE_END_S;
        if (nearEnd && !this.rewinding && this.status === 'playing') {
            this.rewinding = true;
            this.send('seekTo', [0, true]);
        } else if (!nearEnd) {
            this.rewinding = false;
        }
    }

    /** A linear ramp in `setVolume` steps. */
    private fadeTo(volume: number, ms: number, done?: () => void): void {
        this.clock.clearInterval(this.fade);
        const from = this.volume;
        const steps = Math.max(1, Math.round(ms / FADE_STEP_MS));
        let step = 0;
        this.fade = this.clock.setInterval(() => {
            step++;
            this.volume = Math.round(from + ((volume - from) * step) / steps);
            this.send('setVolume', [this.volume]);
            if (step >= steps) {
                this.clock.clearInterval(this.fade);
                done?.();
            }
        }, FADE_STEP_MS);
    }

    private setStatus(status: SoundtrackStatus): void {
        if (status === this.status) return;
        this.status = status;
        this.emit();
    }

    private emit(): void {
        this.listeners.forEach((listener) => listener());
    }
}
