import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowDownTrayIcon, ArrowPathIcon, ArrowUpOnSquareIcon } from '@heroicons/react/24/solid';
import type { Film } from '../../../types/film';
import { DEFAULT_MEMBER_IMAGE, type TeamMember } from '../../../types/team';
import type { MemberRetrospective } from '../../../utils/retrospectiveUtils';
import { prefersReducedMotion } from '../../../utils/motion';
import CircularImage from '../../common/CircularImage';
import CountUp from '../CountUp';
import Slide, { Reveal } from '../Slide';
import {
    canvasUrl,
    deliverPoster,
    renderPoster,
    sharesFiles,
    shelfPicks,
    type PosterContent,
    type RenderedPoster,
} from '../posterImage';
import {
    formatScore,
    memberColor,
    posterFigures,
    posterFilename,
    retrospectivePath,
} from './format';

interface MemberClosingProps {
    year: number;
    member: TeamMember;
    closing: MemberRetrospective['closing'];
    /** The other members with a report this year. */
    others: TeamMember[];
    accent: string;
    /** Stills for the poster's key art, best first: the favourite's, then the year's. */
    keyArt: string[];
    /** The films they picked for the club this year, for the poster's shelf. */
    picks: Film[] | null;
    /** Stills for the reel across the top. */
    reel?: string[];
}

/**
 * The card's width, as `--card-w`: as large as the room allows at 2:3, leaving
 * just enough height for what's around it: the slide's padding, a margin
 * above, and one line of links led by the save button. On a phone the card
 * rises over the reel with the line under it; wider, the reel is in the bottom
 * bar; on a wide screen the line moves beside it, and the card takes nearly
 * the whole height.
 */
const CARD_WIDTH =
    '[--card-w:min(100%,calc((100dvh_-_var(--bar,0px)_-_env(safe-area-inset-top)_-_8.25rem)*2/3))] ' +
    'sm:[--card-w:min(100%,32rem,calc((100dvh_-_var(--bar,0px)_-_env(safe-area-inset-top)_-_8.75rem)*2/3))] ' +
    'lg:[--card-w:min(36rem,calc((100dvh_-_var(--bar,0px)_-_env(safe-area-inset-top)_-_5.5rem)*2/3))]';

/** A one-sheet on the card's shelf, sized to match the saved image's (130 of 1080). */
const ShelfPoster: React.FC<{ film: Film; children?: React.ReactNode }> = ({ film, children }) => {
    // Loaded as the saved image will load it, so that's already cached when
    // it's drawn; then plainly, should that fail; then the title on a card.
    const [attempt, setAttempt] = useState(0);
    const poster = film.poster && !film.poster.includes('N/A') ? film.poster : null;
    const src = !poster || attempt > 1 ? null : attempt === 0 ? canvasUrl(poster) : poster;
    return (
        <div className="relative w-[12cqw] shrink-0" title={film.title}>
            {src ? (
                <img
                    key={src}
                    src={src}
                    alt={film.title}
                    crossOrigin={attempt === 0 ? 'anonymous' : undefined}
                    onError={() => setAttempt((n) => n + 1)}
                    className="aspect-[2/3] w-full object-cover shadow-lg ring-1 ring-slate-100/10"
                />
            ) : (
                <div className="flex aspect-[2/3] w-full items-center justify-center bg-slate-800 p-[1cqw] font-serif text-[1.9cqw] leading-tight text-slate-300 ring-1 ring-slate-100/10">
                    {film.title}
                </div>
            )}
            {children}
        </div>
    );
};

/** The key art's top darkened for the line over it, and its foot faded into the card. */
const ART_SHADE =
    'linear-gradient(to bottom, rgba(3,6,20,0.8) 0%, rgba(3,6,20,0) 24%, rgba(3,6,20,0) 48%, rgba(3,6,20,0.85) 82%, #030614 100%)';

type SaveState = 'idle' | 'working' | 'failed';

/**
 * The year as a one-sheet: the favourite's still for key art, their face where
 * it fades, their name and the year in their colour, a shelf of the favourite
 * (with its score) and the films they picked, the figures, and a line of
 * billing along the foot. Beside or under it, a button to keep it — the same
 * poster drawn as a story-sized image — and the way on to the club's report
 * and everyone else's.
 *
 * Every member has a poster: one with no club scores has no favourite or
 * average, and the art falls back to the year's stills.
 */
const MemberClosing: React.FC<MemberClosingProps> = ({
    year,
    member,
    closing,
    others,
    accent,
    keyArt,
    picks,
    reel,
}) => {
    const still = prefersReducedMotion();
    const figures = posterFigures(closing);
    const favourite = closing.favourite;
    const shelf = shelfPicks(picks ?? []);

    // Each still is loaded as the saved image will load it, so it's cached by
    // the time that's drawn; should that fail, plainly; then the next still.
    const [artAttempt, setArtAttempt] = useState(0);
    const art = keyArt[Math.floor(artAttempt / 2)];
    const artPlain = artAttempt % 2 === 1;
    const artSrc = art && (artPlain ? art : canvasUrl(art));
    /** The card's key art has loaded, or given up, or had long enough. */
    const [artSettled, setArtSettled] = useState(false);
    useEffect(() => {
        const timer = window.setTimeout(() => setArtSettled(true), 4000);
        return () => window.clearTimeout(timer);
    }, []);

    const content = useMemo<PosterContent>(
        () => ({
            year,
            name: member.name,
            avatar: member.image?.trim() || DEFAULT_MEMBER_IMAGE,
            accent,
            keyArt,
            favourite: favourite
                ? {
                      title: favourite.film.title,
                      score: formatScore(favourite.score),
                      poster: favourite.film.poster ?? null,
                  }
                : null,
            picks: (picks ?? []).map((film) => ({
                title: film.title,
                poster: film.poster ?? null,
            })),
            figures: posterFigures(closing),
        }),
        [year, member, accent, keyArt, favourite, picks, closing]
    );

    // A phone's share sheet only opens straight from a tap, so there the image
    // is drawn ahead of time — once the card's own art is in, so it's drawn
    // from the cache rather than racing the card for the network. Anywhere
    // else it's drawn when asked for.
    const [shares] = useState(sharesFiles);
    const pending = useRef<Promise<RenderedPoster | null> | null>(null);
    useEffect(() => {
        pending.current = shares && artSettled ? renderPoster(content) : null;
    }, [shares, artSettled, content]);

    const [saveState, setSaveState] = useState<SaveState>('idle');
    const save = async () => {
        setSaveState('working');
        try {
            pending.current ??= renderPoster(content);
            let poster = await pending.current;
            // One drawn ahead of time whose key art didn't come in (a slow
            // network, say) is drawn again rather than handed over bare.
            if (poster && !poster.complete) {
                pending.current = renderPoster(content);
                poster = await pending.current;
            }
            if (!poster) {
                pending.current = null;
                setSaveState('failed');
                return;
            }
            // Never keep one without its art: the next tap tries again.
            if (!poster.complete) pending.current = null;
            await deliverPoster(
                poster.blob,
                posterFilename(year, member.name),
                `${member.name}'s ${year}`
            );
            setSaveState('idle');
        } catch {
            pending.current = null;
            setSaveState('failed');
        }
    };

    const SaveIcon = shares ? ArrowUpOnSquareIcon : ArrowDownTrayIcon;
    const saveLabel =
        saveState === 'working'
            ? 'Making the image…'
            : saveState === 'failed'
              ? 'Couldn’t make the image — try again'
              : `${shares ? 'Share' : 'Save'} ${member.name}'s ${year} poster as an image`;
    // An icon only, leading the line of links, so it takes no room of its own.
    const saveButton = (
        <button
            type="button"
            onClick={save}
            disabled={saveState === 'working'}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-950 shadow-lg transition hover:brightness-110 disabled:opacity-60"
            style={{ backgroundColor: accent }}
            aria-label={saveLabel}
            title={saveLabel}
        >
            {saveState === 'failed' ? (
                <ArrowPathIcon className="h-4 w-4" aria-hidden="true" />
            ) : (
                <SaveIcon
                    className={`h-4 w-4 ${saveState === 'working' ? 'animate-pulse' : ''}`}
                    aria-hidden="true"
                />
            )}
        </button>
    );

    return (
        <Slide reel={reel} reelBehind className="text-center">
            <div className="flex flex-col items-center lg:flex-row lg:justify-center lg:gap-12">
                <Reveal className="w-full lg:w-auto">
                    <figure
                        className={`@container relative mx-auto mt-3 aspect-[2/3] sm:mt-4 w-[var(--card-w)] overflow-hidden rounded-md bg-slate-950 ${CARD_WIDTH}`}
                        style={{
                            boxShadow: `0 0 0 1px ${accent}40, 0 30px 80px -24px ${accent}66`,
                        }}
                        aria-label={`${member.name}'s ${year}, as a poster`}
                    >
                        {/* Clipped to its own box, so the slow push in never
                            spills an unshaded band of the still below the fade. */}
                        {art && (
                            <div className="absolute inset-x-0 top-0 h-[58%] overflow-hidden">
                                <motion.img
                                    key={artSrc}
                                    src={artSrc}
                                    alt=""
                                    crossOrigin={artPlain ? undefined : 'anonymous'}
                                    className="h-full w-full object-cover"
                                    initial={still ? false : { scale: 1.04 }}
                                    animate={still ? undefined : { scale: 1.14 }}
                                    transition={{
                                        duration: 22,
                                        ease: 'linear',
                                        repeat: Infinity,
                                        repeatType: 'reverse',
                                    }}
                                    onLoad={() => setArtSettled(true)}
                                    onError={() => setArtAttempt((n) => n + 1)}
                                />
                            </div>
                        )}
                        <div
                            className="absolute inset-x-0 top-0 h-[58%]"
                            style={{ backgroundImage: ART_SHADE }}
                            aria-hidden="true"
                        />
                        <div
                            className="absolute inset-0"
                            style={{
                                backgroundImage: `radial-gradient(ellipse 90% 55% at 50% 112%, ${accent}52, transparent 70%)`,
                            }}
                            aria-hidden="true"
                        />

                        <p className="absolute inset-x-0 top-[6.5cqw] font-sans text-[2.6cqw] font-semibold uppercase tracking-[0.35em] text-slate-100">
                            The Criterion Club
                        </p>

                        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-[6cqw] pb-[5cqw]">
                            <div
                                className="rounded-full bg-slate-950 p-[1.1cqw]"
                                style={{ boxShadow: `0 0 0 0.55cqw ${accent}` }}
                            >
                                <CircularImage
                                    src={member.image}
                                    alt={member.name}
                                    size="w-[18cqw] h-[18cqw]"
                                    className="!border-0"
                                />
                            </div>
                            <p className="mt-[3cqw] max-w-full truncate font-serif text-[8cqw] leading-none text-slate-50">
                                {member.name}'s
                            </p>
                            <p
                                className="font-serif text-[25cqw] leading-[0.9] tracking-[-0.03em]"
                                style={{ color: accent }}
                            >
                                {year}
                            </p>

                            {(favourite || shelf.shown.length > 0) && (
                                <div className="mt-[3.5cqw] flex items-end justify-center gap-[5.2cqw]">
                                    {favourite && (
                                        <div className="flex flex-col items-center">
                                            <ShelfLabel>Favourite</ShelfLabel>
                                            <ShelfPoster film={favourite.film}>
                                                <span
                                                    className="absolute -bottom-[0.75cqw] -right-[0.75cqw] flex h-[6.3cqw] w-[6.3cqw] items-center justify-center rounded-full font-sans text-[2.9cqw] font-bold text-slate-950 ring-[0.4cqw] ring-slate-950"
                                                    style={{ backgroundColor: accent }}
                                                    aria-label={`scored ${formatScore(favourite.score)}`}
                                                >
                                                    {formatScore(favourite.score)}
                                                </span>
                                            </ShelfPoster>
                                        </div>
                                    )}
                                    {favourite && shelf.shown.length > 0 && (
                                        <span
                                            className="h-[18cqw] w-px self-end bg-slate-100/15"
                                            aria-hidden="true"
                                        />
                                    )}
                                    {shelf.shown.length > 0 && (
                                        <div className="flex flex-col items-center">
                                            <ShelfLabel>Picks</ShelfLabel>
                                            <div className="flex gap-[1.5cqw]">
                                                {shelf.shown.map((film) => (
                                                    <ShelfPoster key={film.imdbID} film={film} />
                                                ))}
                                                {shelf.more > 0 && (
                                                    <div className="flex aspect-[2/3] w-[12cqw] items-center justify-center bg-slate-100/5 font-sans text-[4.8cqw] font-light text-slate-300">
                                                        +{shelf.more}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <dl className="mt-[4.5cqw] flex justify-center divide-x divide-slate-100/15">
                                {figures.map((figure, i) => (
                                    <div
                                        key={figure.label}
                                        className="flex w-[24cqw] flex-col-reverse items-center"
                                    >
                                        <dt className="mt-[0.8cqw] font-sans text-[2cqw] font-semibold uppercase tracking-[0.25em] text-slate-400">
                                            {figure.label}
                                        </dt>
                                        <dd className="font-sans text-[7.4cqw] font-light leading-none tabular-nums text-slate-50">
                                            <CountUp
                                                value={Number(figure.value)}
                                                digits={figure.value.includes('.') ? 1 : 0}
                                                delay={0.6 + i * 0.15}
                                            />
                                        </dd>
                                    </div>
                                ))}
                            </dl>

                            <p className="mt-[3.5cqw] max-w-full truncate font-sans text-[1.9cqw] font-medium uppercase tracking-[0.28em] text-slate-500">
                                criterionclub.org
                            </p>
                        </div>
                    </figure>
                </Reveal>

                <Reveal step={1}>
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 lg:mt-0 lg:flex-col lg:items-start lg:gap-y-3 lg:text-left">
                        {saveButton}
                        <nav
                            aria-label="Other retrospectives"
                            className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm lg:flex-col lg:items-start lg:gap-y-2"
                        >
                            <Link
                                to={retrospectivePath(year)}
                                className="font-medium text-slate-200 underline-offset-4 hover:underline"
                            >
                                The club's year
                            </Link>
                            {others.map((other, i) => (
                                <Link
                                    key={other.name}
                                    to={retrospectivePath(year, other.name)}
                                    className="font-medium underline-offset-4 hover:underline"
                                    style={{ color: memberColor(other, i) }}
                                >
                                    {other.name}
                                </Link>
                            ))}
                        </nav>
                    </div>
                </Reveal>
            </div>
        </Slide>
    );
};

/** The small caps over a group on the shelf. */
const ShelfLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p className="mb-[1.4cqw] font-sans text-[2cqw] font-semibold uppercase tracking-[0.25em] text-slate-400">
        {children}
    </p>
);

export default MemberClosing;
