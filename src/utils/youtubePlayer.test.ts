import {
    BLOCKED_AFTER_MS,
    FADE_IN_MS,
    FADE_OUT_MS,
    REWIND_BEFORE_END_S,
    TARGET_VOLUME,
    YOUTUBE_ORIGIN,
    YouTubeSoundtrack,
    parsePlayerMessage,
    soundtrackEmbedUrl,
    type Clock,
} from './youtubePlayer';

// Messages in the shape the embed posts to its parent, as the official IFrame
// API script receives them: JSON strings tagged with the listener's id.
const FRAMES = {
    initialDelivery: JSON.stringify({
        event: 'initialDelivery',
        info: { playerState: -1, volume: 100, muted: false, currentTime: 0 },
        id: 1,
        channel: 'widget',
    }),
    onReady: JSON.stringify({ event: 'onReady', info: null, id: 1, channel: 'widget' }),
    buffering: JSON.stringify({ event: 'onStateChange', info: 3, id: 1, channel: 'widget' }),
    playing: JSON.stringify({ event: 'onStateChange', info: 1, id: 1, channel: 'widget' }),
    pausedInfo: JSON.stringify({
        event: 'infoDelivery',
        info: { playerState: 2, currentTime: 41.2 },
        id: 1,
        channel: 'widget',
    }),
    mutedInfo: JSON.stringify({
        event: 'infoDelivery',
        info: { muted: true, volume: 70 },
        id: 1,
        channel: 'widget',
    }),
};

const clock: Clock = {
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: (h) => clearInterval(h as ReturnType<typeof setInterval>),
};

const setup = () => {
    const postMessage = jest.fn();
    const track = new YouTubeSoundtrack(() => ({ postMessage }), clock);
    const sent = () =>
        postMessage.mock.calls.map(([message, origin]) => {
            expect(origin).toBe(YOUTUBE_ORIGIN);
            return JSON.parse(message as string) as { event: string; func?: string; args?: [] };
        });
    const commands = () =>
        sent()
            .filter((m) => m.event === 'command')
            .map((m) => [m.func, ...(m.args ?? [])]);
    const receive = (frame: string) => track.receive(YOUTUBE_ORIGIN, frame);
    return { track, postMessage, sent, commands, receive };
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('soundtrackEmbedUrl', () => {
    it('enables the API for this origin and loops the one video', () => {
        const url = new URL(soundtrackEmbedUrl('abcdefghijk', 'https://www.criterionclub.org'));
        expect(url.origin).toBe(YOUTUBE_ORIGIN);
        expect(url.pathname).toBe('/embed/abcdefghijk');
        expect(url.searchParams.get('enablejsapi')).toBe('1');
        expect(url.searchParams.get('origin')).toBe('https://www.criterionclub.org');
        expect(url.searchParams.get('loop')).toBe('1');
        expect(url.searchParams.get('playlist')).toBe('abcdefghijk');
    });

    it('leads the queue with the chosen video, the following ones after it', () => {
        const url = new URL(
            soundtrackEmbedUrl('abcdefghijk', 'https://www.criterionclub.org', [
                'bcdefghijkl',
                '-cdefghijkm',
            ])
        );
        expect(url.pathname).toBe('/embed/abcdefghijk');
        expect(url.searchParams.get('playlist')).toBe('abcdefghijk,bcdefghijkl,-cdefghijkm');
        expect(url.searchParams.get('list')).toBeNull();
        expect(url.searchParams.get('loop')).toBe('1');
    });
});

describe('parsePlayerMessage', () => {
    it('reads the frames the embed sends', () => {
        expect(parsePlayerMessage(YOUTUBE_ORIGIN, FRAMES.onReady)).toEqual({ ready: true });
        expect(parsePlayerMessage(YOUTUBE_ORIGIN, FRAMES.playing)).toEqual({ state: 'playing' });
        expect(parsePlayerMessage(YOUTUBE_ORIGIN, FRAMES.initialDelivery)).toEqual({
            state: 'unstarted',
            volume: 100,
            muted: false,
            currentTime: 0,
        });
        expect(parsePlayerMessage(YOUTUBE_ORIGIN, FRAMES.pausedInfo)).toEqual({
            state: 'paused',
            currentTime: 41.2,
        });
    });

    it('ignores other origins, other events and junk', () => {
        expect(parsePlayerMessage('https://evil.example', FRAMES.playing)).toBeNull();
        expect(parsePlayerMessage(YOUTUBE_ORIGIN, '{"event":"onApiChange"}')).toBeNull();
        expect(parsePlayerMessage(YOUTUBE_ORIGIN, 'not json')).toBeNull();
        expect(parsePlayerMessage(YOUTUBE_ORIGIN, 42)).toBeNull();
    });
});

const info = (fields: Record<string, unknown>) =>
    JSON.stringify({ event: 'infoDelivery', info: fields, id: 1, channel: 'widget' });
const ENDED = JSON.stringify({ event: 'onStateChange', info: 0, id: 1, channel: 'widget' });

describe('YouTubeSoundtrack', () => {
    it('asks the embed to listen until it is ready, then stops asking', () => {
        const { track, sent, receive } = setup();
        track.connect();
        jest.advanceTimersByTime(600);
        expect(sent().filter((m) => m.event === 'listening')).toHaveLength(3);

        receive(FRAMES.onReady);
        jest.advanceTimersByTime(2000);
        expect(sent().filter((m) => m.event === 'listening')).toHaveLength(3);
    });

    it('holds commands sent before the embed is ready, and delivers them in order', () => {
        const { track, commands, receive } = setup();
        track.start();
        expect(commands()).toEqual([]);
        receive(FRAMES.onReady);
        expect(commands()).toEqual([['setVolume', 0], ['unMute'], ['playVideo']]);
    });

    it('fades in once the embed reports it is playing', () => {
        const { track, commands, receive } = setup();
        receive(FRAMES.onReady);
        track.start();
        expect(track.status).toBe('starting');

        receive(FRAMES.buffering);
        receive(FRAMES.playing);
        expect(track.status).toBe('playing');
        jest.advanceTimersByTime(FADE_IN_MS);

        const volumes = commands()
            .filter(([func]) => func === 'setVolume')
            .map(([, v]) => Number(v));
        expect(volumes[0]).toBe(0);
        expect(volumes[volumes.length - 1]).toBe(TARGET_VOLUME);
        expect(volumes).toEqual([...volumes].sort((a, b) => a - b));
    });

    it('reports blocked when play never takes, and recovers when the reader taps the video', () => {
        const { track, receive } = setup();
        const changes = jest.fn();
        track.subscribe(changes);
        receive(FRAMES.onReady);
        track.start();

        jest.advanceTimersByTime(BLOCKED_AFTER_MS);
        expect(track.status).toBe('blocked');

        receive(FRAMES.playing);
        expect(track.status).toBe('playing');
        expect(changes).toHaveBeenCalledTimes(3);
    });

    it('fades out and pauses on stop, without calling its own pause the reader’s', () => {
        const { track, commands, receive } = setup();
        receive(FRAMES.onReady);
        track.start();
        receive(FRAMES.playing);
        jest.advanceTimersByTime(FADE_IN_MS);

        track.stop();
        receive(FRAMES.pausedInfo);
        expect(track.status).toBe('playing');
        jest.advanceTimersByTime(FADE_OUT_MS);

        expect(commands().slice(-2)).toEqual([['setVolume', 0], ['pauseVideo']]);
        expect(track.status).toBe('paused');
    });

    it('mutes, and follows a mute made on the player itself', () => {
        const { track, commands, receive } = setup();
        receive(FRAMES.onReady);
        track.setMuted(true);
        expect(commands()).toEqual([['mute']]);

        track.setMuted(false);
        receive(FRAMES.mutedInfo);
        expect(track.muted).toBe(true);
    });

    it('forgets the old embed on reset, and waits for the new one', () => {
        const { track, commands, receive } = setup();
        receive(FRAMES.onReady);
        track.start();
        receive(FRAMES.playing);
        const before = commands().length;

        track.reset();
        expect(track.status).toBe('idle');
        track.start();
        expect(commands()).toHaveLength(before);
        receive(FRAMES.onReady);
        expect(commands().slice(before)).toEqual([['setVolume', 0], ['unMute'], ['playVideo']]);
    });

    it('stops every timer on dispose', () => {
        const { track } = setup();
        track.connect();
        track.start();
        track.dispose();
        expect(jest.getTimerCount()).toBe(0);
    });

    describe('repeating one video in a queue', () => {
        const playingAt = () => {
            const harness = setup();
            harness.receive(FRAMES.onReady);
            harness.track.start();
            harness.receive(FRAMES.playing);
            harness.receive(info({ playlistIndex: 2, duration: 120, currentTime: 10 }));
            return harness;
        };
        const seeks = (commands: () => unknown[][]) =>
            commands().filter(([func]) => func === 'seekTo');

        it('goes back to the start just before the end, once per pass', () => {
            const { receive, commands } = playingAt();
            receive(info({ currentTime: 120 - REWIND_BEFORE_END_S - 0.5 }));
            expect(seeks(commands)).toEqual([]);

            receive(info({ currentTime: 119.4 }));
            receive(info({ currentTime: 119.7 }));
            expect(seeks(commands)).toEqual([['seekTo', 0, true]]);

            receive(info({ currentTime: 0.2 }));
            receive(info({ currentTime: 119.5 }));
            expect(seeks(commands)).toHaveLength(2);
        });

        it('puts the player back on the video that ended if the end is missed', () => {
            const { track, receive, commands } = playingAt();
            receive(ENDED);
            expect(commands().slice(-1)[0]).toEqual(['playVideoAt', 2]);
            expect(track.status).toBe('playing');
        });

        it('follows the reader skipping, and repeats the new video instead', () => {
            const { track, receive, commands } = playingAt();
            const listener = jest.fn();
            track.subscribe(listener);
            receive(info({ playlistIndex: 3 }));
            expect(track.playlistIndex).toBe(3);
            expect(listener).toHaveBeenCalled();

            receive(ENDED);
            expect(commands().slice(-1)[0]).toEqual(['playVideoAt', 3]);
        });

        it('does not rewind while paused or stopping', () => {
            const { track, receive, commands } = playingAt();
            track.pause();
            receive(info({ currentTime: 119.5 }));
            expect(seeks(commands)).toEqual([]);
        });

        it('starts over at the front of the queue after a reset', () => {
            const { track } = playingAt();
            expect(track.playlistIndex).toBe(2);
            track.reset();
            expect(track.playlistIndex).toBe(0);
        });
    });
});
