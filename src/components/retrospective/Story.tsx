import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    PauseIcon,
    PlayIcon,
    SpeakerWaveIcon,
    SpeakerXMarkIcon,
    XMarkIcon,
} from '@heroicons/react/24/solid';
import type { FrameImage } from '../../utils/frameSources';
import { useMarquee } from '../../hooks/useMarquee';
import { prefersReducedMotion } from '../../utils/motion';
import FilmReel from './FilmReel';
import LeaveDialog from './LeaveDialog';
import Mosaic from './Mosaic';
import StillsBackdrop from './StillsBackdrop';
import StoryProgress from './StoryProgress';
import { FaceStack } from './slides/shared';

export interface StorySlide {
    /** Stable across renders; names the slide in the address. */
    id: string;
    node: React.ReactNode;
    /** How strongly the year's art shows behind this slide, 0–1. Faint by default. */
    artStrength?: number;
    /**
     * Stills of the film this slide features. When there are any they play
     * behind the slide in place of the year's wall of art.
     */
    stills?: string[];
    /**
     * Stills for this slide's reel of film. On anything wider than a phone the
     * reel runs through the bottom bar, between the controls and the player;
     * slides without one show the year's stills there. (On a phone the slide
     * draws the reel itself, at its top.)
     */
    reel?: string[];
}

const CONTROL =
    'rounded-full bg-slate-950/70 p-2 text-slate-200 ring-1 ring-slate-100/20 backdrop-blur-sm transition-colors hover:text-slate-50 disabled:opacity-30 sm:p-2.5';

/** Where the reader is: "3 / 13". */
const Counter: React.FC<{ index: number; count: number }> = ({ index, count }) => (
    <span className="ml-1 whitespace-nowrap font-sans text-xs tabular-nums text-slate-300">
        {index + 1} / {count}
    </span>
);

/**
 * The year's posters and stills drifting behind the bottom bar, darkened most
 * on the left where the controls sit and least toward the player.
 */
const BarArt: React.FC<{ art: FrameImage[] }> = ({ art }) => {
    const row = art.length < 12 ? [...art, ...art, ...art] : art;
    const marquee = useMarquee(row.length);
    if (!art.length) return null;
    return (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div
                ref={marquee.ref}
                className={`flex h-full w-max gap-1 py-1 ${marquee.className}`}
                style={marquee.style}
            >
                {[...row, ...row].map((image, i) => (
                    <img
                        key={`${image.url}-${i}`}
                        src={image.url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className={`h-full shrink-0 rounded-[2px] object-cover opacity-45 ${
                            image.kind === 'poster' ? 'aspect-[2/3]' : 'aspect-video'
                        }`}
                    />
                ))}
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/55 to-slate-950/30" />
        </div>
    );
};

/**
 * The bar's height, safe area aside: with music, the 200px player and 8px
 * either side of it; without, one row of controls.
 */
const BAR_WITH_PLAYER = 216;
const BAR_PLAIN = 64;

/** The art behind a slide that doesn't ask for more: there, but under the words. */
const QUIET_ART = 0.14;

interface StoryProps {
    slides: StorySlide[];
    /** The year's posters and stills, shown behind every slide. */
    art: FrameImage[];
    index: number;
    onIndexChange: (index: number) => void;
    onClose: () => void;
    accent: string;
    /**
     * Whose deck this is: the member, or the club's roster. Their faces lead
     * the progress bar on every slide.
     */
    faces?: { name: string; color?: string }[];
    /**
     * The music, when there is any. Its player sits in the bar along the
     * bottom, and the slides end above the bar so nothing is drawn under it.
     */
    music?: {
        label: string;
        muted: boolean;
        onToggleMute: () => void;
        /** Play was refused: the reader has to tap the video. */
        blocked: boolean;
    };
    /** Called when the reader holds the deck, and again when they let go. */
    onHold?: (held: boolean) => void;
}

/** Where the deck's links can go without asking: another retrospective. */
const RETROSPECTIVE_PREFIX = '/retrospective/';

/**
 * Where a link in a slide would take the reader, if that's out of the
 * retrospective and in this tab; null for anything to let through. Routes live
 * in the hash, so a Link's href is `#/films/…`.
 */
const leavingFor = (event: React.MouseEvent): string | null => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return null;
    }
    const anchor = (event.target as Element).closest('a[href]');
    if (!anchor || (anchor.getAttribute('target') ?? '_self') !== '_self') return null;
    const href = anchor.getAttribute('href') ?? '';
    if (href.startsWith('#')) {
        const path = href.slice(1);
        return path.startsWith(RETROSPECTIVE_PREFIX) ? null : path;
    }
    return (anchor as HTMLAnchorElement).href;
};

/** How long a slide holds when the deck is playing itself. */
const SLIDE_MS = 11000;
/** Held this long, a press is a pause rather than a tap. */
const HOLD_MS = 250;
/** Moved this far sideways, a press is a swipe. */
const SWIPE_PX = 50;

/**
 * The full-screen deck: one slide at a time, a progress bar along the top, and
 * a close control in the corner every story app puts it.
 *
 * The reader moves through it by hand unless they ask otherwise: tap the right
 * two-thirds to go on and the left third to go back, swipe, use the arrow keys
 * and space, or the arrows in the corner. The play control beside them sets the
 * deck going by itself, a slide every few seconds, and pauses it again; holding
 * a slide pauses it too. Moving by hand while it plays restarts the slide's
 * clock rather than fighting it. Reduced motion makes the transitions cuts.
 */
const Story: React.FC<StoryProps> = ({
    slides,
    art,
    index,
    onIndexChange,
    onClose,
    accent,
    faces,
    music,
    onHold,
}) => {
    const still = prefersReducedMotion();
    /** Off until the reader turns it on: the deck waits on them by default. */
    const [autoplay, setAutoplay] = useState(false);
    const [held, setHeld] = useState(false);
    const [lastTouch, setLastTouch] = useState(0);
    const press = useRef<{ x: number; y: number; timer: number; held: boolean } | null>(null);
    /** A link out of the retrospective, waiting on the reader to confirm it. */
    const [leaving, setLeaving] = useState<string | null>(null);
    const navigate = useNavigate();

    // A link in a slide that leaves the retrospective asks first; the
    // closing slides' links to other retrospectives just go.
    const onClickCapture = (event: React.MouseEvent) => {
        const destination = leavingFor(event);
        if (destination === null) return;
        // Prevented here, Link sees it and doesn't navigate.
        event.preventDefault();
        setLeaving(destination);
    };
    const stay = useCallback(() => setLeaving(null), []);
    const leave = () => {
        if (leaving === null) return;
        if (leaving.startsWith('/')) navigate(leaving);
        else window.location.assign(leaving);
    };

    const go = useCallback(
        (next: number) => {
            if (next < 0 || next >= slides.length || next === index) return;
            onIndexChange(next);
        },
        [index, slides.length, onIndexChange]
    );

    const touched = useCallback(() => setLastTouch(Date.now()), []);

    // Keyboard.
    useEffect(() => {
        if (leaving !== null) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'ArrowRight' || event.key === ' ') {
                event.preventDefault();
                touched();
                go(index + 1);
            } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                touched();
                go(index - 1);
            } else if (event.key === 'Escape') {
                onClose();
            } else if (event.key === 'p' || event.key === 'k') {
                setAutoplay((on) => !on);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [go, index, onClose, touched, leaving]);

    // Moving on by itself, when asked to. It stops at the last slide.
    const running = autoplay && !held && leaving === null && index < slides.length - 1;
    useEffect(() => {
        if (!running) return;
        const timer = window.setTimeout(() => go(index + 1), SLIDE_MS);
        return () => window.clearTimeout(timer);
    }, [running, index, lastTouch, go]);

    const setHolding = (value: boolean) => {
        setHeld(value);
        onHold?.(value);
    };

    const onPointerDown = (event: React.PointerEvent) => {
        if (
            (event.target as Element).closest(
                'a, button, iframe, [data-deck-bar], [data-deck-dialog]'
            )
        )
            return;
        const timer = window.setTimeout(() => {
            if (press.current) {
                press.current.held = true;
                setHolding(true);
            }
        }, HOLD_MS);
        press.current = { x: event.clientX, y: event.clientY, timer, held: false };
    };

    const onPointerUp = (event: React.PointerEvent) => {
        const start = press.current;
        press.current = null;
        if (!start) return;
        window.clearTimeout(start.timer);
        if (start.held) {
            setHolding(false);
            return;
        }
        touched();
        const dx = event.clientX - start.x;
        if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(event.clientY - start.y)) {
            go(dx < 0 ? index + 1 : index - 1);
            return;
        }
        const { left, width } = event.currentTarget.getBoundingClientRect();
        go(event.clientX - left < width / 3 ? index - 1 : index + 1);
    };

    const onPointerCancel = () => {
        if (press.current) window.clearTimeout(press.current.timer);
        if (press.current?.held) setHolding(false);
        press.current = null;
    };

    const slide = slides[index];
    const stills = slide.stills?.filter(Boolean) ?? [];

    // One wall of art for the whole deck, brightening and dimming with the
    // slide, so moving on changes the words and not the room they're in.
    return (
        <motion.div
            className="fixed inset-0 z-[70] touch-pan-y select-none overflow-hidden bg-page pt-[env(safe-area-inset-top)]"
            style={{
                ['--bar' as string]: `calc(${music ? BAR_WITH_PLAYER : BAR_PLAIN}px + env(safe-area-inset-bottom))`,
            }}
            role="region"
            aria-roledescription="slideshow"
            aria-label="Retrospective"
            initial={still ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onClickCapture={onClickCapture}
            onContextMenu={(event) => event.preventDefault()}
        >
            <motion.div
                className="absolute inset-0"
                initial={false}
                animate={{ opacity: stills.length ? 0.06 : (slide.artStrength ?? QUIET_ART) }}
                transition={{ duration: still ? 0 : 1.2, ease: 'easeInOut' }}
            >
                <Mosaic images={art} strength={1} />
            </motion.div>

            {/* A featured film's own frames, dissolving in over the wall. Keyed
                on the slide, so two film slides in a row cross-dissolve. */}
            <AnimatePresence initial={false}>
                {stills.length > 0 && (
                    <motion.div
                        key={slide.id}
                        className="absolute inset-0"
                        initial={still ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: still ? 0 : 1.2, ease: 'easeInOut' }}
                    >
                        <StillsBackdrop images={stills} strength={0.55} />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* A crossfade: the outgoing slide fades quickly while the next
                settles in a beat behind it, so the two never sit at full
                strength together. */}
            {/* The slides end where the bar begins. */}
            <div className="absolute inset-x-0 top-0 bottom-[var(--bar)]">
                <AnimatePresence initial={false}>
                    <motion.div
                        key={slide.id}
                        className="absolute inset-0"
                        initial={still ? false : { opacity: 0, scale: 0.985 }}
                        animate={{
                            opacity: 1,
                            scale: 1,
                            transition: still
                                ? { duration: 0 }
                                : { duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] },
                        }}
                        exit={{
                            opacity: 0,
                            transition: { duration: still ? 0 : 0.3, ease: 'easeIn' },
                        }}
                        aria-live="polite"
                    >
                        {slide.node}
                    </motion.div>
                </AnimatePresence>
            </div>

            <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 px-3 pt-[calc(env(safe-area-inset-top)+0.25rem)] sm:gap-3 sm:px-6">
                {faces && faces.length > 0 && (
                    <FaceStack faces={faces} size="h-4 w-4 sm:h-5 sm:w-5" className="!-space-x-1" />
                )}
                <div className="min-w-0 flex-1">
                    <StoryProgress
                        onSelect={(i) => {
                            touched();
                            go(i);
                        }}
                        count={slides.length}
                        index={index}
                        runMs={autoplay && index < slides.length - 1 ? SLIDE_MS : null}
                        restartKey={lastTouch}
                        paused={held || leaving !== null}
                        accent={accent}
                    />
                </div>
            </div>

            <button
                type="button"
                onClick={onClose}
                className="absolute right-2 top-[calc(env(safe-area-inset-top)+1.875rem)] z-20 rounded-full bg-slate-950/60 p-1.5 text-slate-300 backdrop-blur-sm transition-colors hover:bg-slate-950/80 hover:text-slate-50 sm:right-4 sm:top-[calc(env(safe-area-inset-top)+2.25rem)] sm:bg-transparent sm:p-2 sm:backdrop-blur-none"
                aria-label="Close the retrospective"
            >
                <XMarkIcon className="h-6 w-6" />
            </button>

            {/* The bar along the bottom: the controls on the left and, when
                there's music, a bay on the right that the player sits in.
                Between them on a wide screen runs the slide's reel of film; on a
                phone, where there's no room between, the year's posters and
                stills drift behind the controls instead. By hand by default;
                the middle control sets the deck going and stops it. */}
            <div
                data-deck-bar
                className="absolute inset-x-0 bottom-0 z-10 flex h-[var(--bar)] overflow-hidden border-t border-slate-100/10 bg-slate-950 pb-[env(safe-area-inset-bottom)]"
            >
                <div className="sm:hidden">
                    <BarArt art={art} />
                </div>
                {/* On a wide screen the reel runs the whole bar up to the
                    player's bay, under the controls, which float over its left
                    end on a panel of their own. */}
                <div
                    className={`absolute inset-y-0 left-0 hidden items-center overflow-hidden pb-[env(safe-area-inset-bottom)] sm:flex ${
                        music ? 'right-[232px]' : 'right-0'
                    }`}
                >
                    <AnimatePresence initial={false}>
                        <motion.div
                            key={slide.reel?.length ? slide.id : 'year'}
                            className="absolute inset-x-0"
                            initial={still ? false : { opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: still ? 0 : 0.8 }}
                        >
                            <FilmReel
                                stills={
                                    slide.reel?.length
                                        ? slide.reel
                                        : art.filter((a) => a.kind === 'still').map((a) => a.url)
                                }
                                frameClass={music ? 'h-36' : 'h-9'}
                                sprocketClass={music ? 'h-4' : 'h-2'}
                                className="!shadow-none"
                            />
                        </motion.div>
                    </AnimatePresence>
                </div>
                <div
                    className={`relative z-10 flex min-w-0 flex-1 flex-col justify-center gap-2 px-3 sm:my-auto sm:ml-4 sm:max-w-[240px] sm:flex-none sm:rounded-xl sm:bg-slate-950/70 sm:shadow-xl sm:ring-1 sm:ring-slate-100/10 sm:backdrop-blur-md ${
                        music ? 'sm:gap-3 sm:p-4' : 'sm:px-2 sm:py-1.5'
                    }`}
                >
                    <div className="flex items-center gap-1 sm:gap-1.5">
                        <button
                            type="button"
                            onClick={() => {
                                touched();
                                go(index - 1);
                            }}
                            disabled={index === 0}
                            className={CONTROL}
                            aria-label="Previous slide"
                        >
                            <ChevronLeftIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setAutoplay((on) => !on)}
                            className={CONTROL}
                            aria-label={
                                autoplay ? 'Pause on this slide' : 'Play the slides automatically'
                            }
                            aria-pressed={autoplay}
                        >
                            {autoplay ? (
                                <PauseIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                            ) : (
                                <PlayIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                touched();
                                go(index + 1);
                            }}
                            disabled={index === slides.length - 1}
                            className={CONTROL}
                            aria-label="Next slide"
                        >
                            <ChevronRightIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                        {!music && <Counter index={index} count={slides.length} />}
                    </div>
                    {music && (
                        <>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={music.onToggleMute}
                                    className={CONTROL}
                                    aria-label={music.muted ? 'Unmute the music' : 'Mute the music'}
                                    aria-pressed={music.muted}
                                >
                                    {music.muted ? (
                                        <SpeakerXMarkIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                                    ) : (
                                        <SpeakerWaveIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                                    )}
                                </button>
                                <Counter index={index} count={slides.length} />
                            </div>
                            <p className="line-clamp-2 max-w-full font-serif text-xs italic leading-snug text-slate-300 sm:text-sm">
                                ♪ {music.label}
                            </p>
                        </>
                    )}
                    {music?.blocked && (
                        <p className="text-[11px] leading-snug text-slate-200 sm:text-xs">
                            Tap the video to start the music →
                        </p>
                    )}
                </div>
                {/* The reel's room on a wide screen is the rest of the bar. */}
                <div className="hidden flex-1 sm:block" />
                {/* The player's bay: the tile is drawn here by the page, fixed,
                    so it survives the deck closing long enough to fade out. */}
                {music && <div className="w-[216px] shrink-0 sm:w-[232px]" aria-hidden="true" />}
            </div>

            <LeaveDialog
                open={leaving !== null}
                onStay={stay}
                onLeave={leave}
                accent={accent}
                still={still}
            />

            <p className="sr-only">
                Slide {index + 1} of {slides.length}. Use the arrow keys to move between slides.
            </p>
        </motion.div>
    );
};

export default Story;
