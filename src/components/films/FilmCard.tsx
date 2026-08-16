import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Film } from '../../types/film';
import { calculateClubAverage, getRatingColorClass } from '../../utils/ratingUtils';
import { CardSize } from '../../contexts/ViewSettingsContext';
import PopcornRating from '../common/PopcornRating';
import {
    PopcornPodStamp,
    POPCORN_POD_POSTER_FILTER,
    RIBBON_FOLD_CLIP_LEFT,
    RIBBON_FOLD_CLIP_RIGHT,
} from './PopcornPod';
import { UserIcon } from '@heroicons/react/20/solid';
import { GlobeEuropeAfricaIcon } from '@heroicons/react/24/solid';

interface FilmCardProps {
    film: Film;
    cardSize: CardSize;
}

/*
 * A single shared IntersectionObserver for every card on the page.
 *
 * Previously each FilmCard created its own observer, which (combined with a
 * per-card opacity/scale fade) thrashed iOS Safari's compositing layers during
 * momentum scrolling. The shared observer only decides *when to start fetching*
 * each poster: a generous rootMargin means images begin loading ~1.5 screens
 * before they enter view, so they are painted by the time you reach them
 * instead of popping in late. Native loading="lazy" fires too late on iOS.
 */
type IntersectCallback = (entry: IntersectionObserverEntry) => void;
const observerCallbacks = new WeakMap<Element, IntersectCallback>();
let sharedObserver: IntersectionObserver | null = null;

const getSharedObserver = (): IntersectionObserver => {
    if (sharedObserver) return sharedObserver;
    sharedObserver = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                observerCallbacks.get(entry.target)?.(entry);
            }
        },
        // ~1.5 screens of look-ahead so fetches start before the card is visible.
        { rootMargin: '1500px 0px', threshold: 0 }
    );
    return sharedObserver;
};

const observeOnce = (el: Element, cb: IntersectCallback): (() => void) => {
    observerCallbacks.set(el, cb);
    getSharedObserver().observe(el);
    return () => {
        observerCallbacks.delete(el);
        sharedObserver?.unobserve(el);
    };
};

const FilmCard: React.FC<FilmCardProps> = ({ film, cardSize }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    // shouldLoad: the card is near the viewport, so begin fetching the poster.
    const [shouldLoad, setShouldLoad] = useState(false);
    // loaded: the poster has decoded, so fade it in from the placeholder tone.
    const [loaded, setLoaded] = useState(false);
    // isVisible: the card is actually on screen, driving the entrance fade.
    const [isVisible, setIsVisible] = useState(false);
    const isCompact = cardSize === 'compact';
    const isPosterOnly = cardSize === 'poster';

    useEffect(() => {
        const currentRef = cardRef.current;
        if (!currentRef || shouldLoad) return;

        return observeOnce(currentRef, (entry) => {
            if (entry.isIntersecting) setShouldLoad(true);
        });
    }, [shouldLoad]);

    useEffect(() => {
        const currentRef = cardRef.current;
        if (!currentRef) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                // Only update state when there's an actual change
                setIsVisible((prev) => {
                    if (prev !== entry.isIntersecting) {
                        return entry.isIntersecting;
                    }
                    return prev;
                });
            },
            {
                threshold: 0.1,
                rootMargin: '50px',
            }
        );

        observer.observe(currentRef);

        return () => observer.disconnect();
    }, []);

    // Extract movie club info safely
    const clubRatings = film.movieClubInfo?.clubRatings;
    const selectorName = film.movieClubInfo?.selector;

    // Prepare rating entries, filtering out null or empty scores
    const ratingEntries = clubRatings ? clubRatings.filter((rating) => rating.score !== null) : [];

    // Calculate club average rating
    const clubAverageDisplay = calculateClubAverage(clubRatings);

    // Format watch date for overlay (MM/DD/YY)
    const watchDateFormatted = film.movieClubInfo?.watchDate
        ? new Date(film.movieClubInfo.watchDate).toLocaleDateString('en-US', {
              month: '2-digit',
              day: '2-digit',
              year: '2-digit',
          })
        : null;

    // Determine if the "Up Next" elements should be shown
    // True if there's no watch date BUT there is a selector assigned
    const showUpNext = !watchDateFormatted && selectorName;

    // A "Hollywood Popcorn Pod" outing rather than a club selection: the poster
    // gets the cheapened treatment and a sash folded over its corner.
    const isPopcornPod = !!film.popcornPod;

    return (
        // Outermost container: Handles visibility transition and relative positioning for the banner
        <div
            ref={cardRef}
            className={`
                transition-opacity duration-500 ease-out
                ${isVisible ? 'opacity-100' : 'opacity-60'}
                relative group rounded-lg overflow-hidden  /* group allows hover states for children */
            `}
        >
            {/* --- UP NEXT BANNER ---
                A folded corner ribbon cut from the same cloth as the Popcorn Pod
                sash: same band construction, same tucked-under tails, same swell
                on hover — in the club's emerald rather than concession amber.

                Every dimension below is in `em` against the wrapper's font size,
                so the whole ribbon holds its proportions and only one number
                (that font size) changes between card sizes. The geometry is
                symmetric about the corner's diagonal: the band's centre sits at
                2.6em along both axes, and the band is wide enough (10.4em) that
                both ends — tails included — fall outside the card's top and left
                edges, where the wrapper's overflow clips them flush. */}
            {showUpNext && (
                <div
                    className={`
                        absolute -top-px -left-px z-30 overflow-hidden pointer-events-none /* Clip-wrapper anchored to the top-left corner */
                        w-[8em] h-[8em] /* Room for the band plus the tails hanging below it */
                        ${isCompact || isPosterOnly ? 'text-[13px]' : 'text-[20px]'}
                    `}
                >
                    {/* Band + tails. Only `scale` is transitioned: Tailwind v4 keeps
                        rotate as its own property, so animating `transform` wholesale
                        would fight the -45deg rake. */}
                    <div
                        className="
                        absolute w-[10.4em] left-[-2.6em] top-[1.7em] -rotate-45
                        transition-[scale] duration-300 ease-out group-hover:scale-105
                    "
                    >
                        {/* Tails, tucked under each end of the band and running off
                            past the card's edges — only the tapering inner tip of
                            each stays visible, so the ribbon reads as folding around
                            the corner rather than being painted on it. */}
                        <div
                            className="absolute top-full left-0 w-[34%] h-[0.75em] bg-emerald-700/90"
                            style={{ clipPath: RIBBON_FOLD_CLIP_LEFT }}
                        />
                        <div
                            className="absolute top-full right-0 w-[34%] h-[0.75em] bg-emerald-700/90"
                            style={{ clipPath: RIBBON_FOLD_CLIP_RIGHT }}
                        />

                        {/* Semi-transparent so the poster still reads through the
                            ribbon, with a blur behind it to keep the lettering legible
                            over busy art. Padding is in `em`, so the band's depth
                            tracks the lettering instead of being set independently. */}
                        <div
                            className="
                            relative text-center whitespace-nowrap leading-none
                            py-[0.34em] tracking-[0.08em]
                            font-black uppercase text-white
                            [text-shadow:0_0.04em_0.1em_rgba(6,78,59,0.7)]
                            bg-gradient-to-r from-emerald-600/90 via-emerald-500/90 to-emerald-600/90
                            backdrop-blur-[2px]
                            border-y border-emerald-800/40 shadow-lg shadow-black/40
                            transition-all duration-300 ease-out
                            group-hover:from-emerald-500/90 group-hover:via-emerald-400/90 group-hover:to-emerald-500/90
                            group-hover:shadow-xl
                        "
                        >
                            Up Next
                        </div>
                    </div>
                </div>
            )}

            {/* --- Link wraps the actual card content --- */}
            <Link to={`/films/${film.imdbID}`} className="block h-full">
                {/* Inner container: Defines card surface, border, layout, and clips content.
                    Same shell as BaseCard/AccentCard's `card` surface — no fill, a
                    hairline border that warms to the accent on hover, and only the
                    faintest shadow. The card is defined by its edge, not by a panel
                    of color or a drop shadow. */}
                <div
                    className={`
                    overflow-hidden h-full flex flex-col
                    border border-slate-700/60 hover:border-blue-400/30 rounded-lg
                    shadow-sm shadow-black/30
                    transition-colors duration-300
                    ${isPopcornPod ? '!border-amber-400/40' : ''}
                `}
                >
                    {/* Poster Container: Fixed aspect ratio, clips image. The slate
                        placeholder background means an in-flight image fades from a
                        neutral tone instead of flashing black on iOS. */}
                    <div
                        className="relative w-full overflow-hidden bg-slate-800"
                        style={{ paddingBottom: '140%' /* Shorter aspect ratio */ }}
                    >
                        {/* Poster Image: Covers container, aligned top.
                            No transform-gpu: forcing a GPU layer on every poster
                            thrashes iOS Safari's limited compositing-tile budget
                            during scroll. will-change is applied only transiently on
                            hover (group-hover is gated behind @media (hover: hover) in
                            Tailwind v4, so iOS never promotes these layers). */}
                        {shouldLoad && (
                            <img
                                src={film.poster}
                                alt={`${film.title} poster`}
                                decoding="async"
                                className={`
                                    absolute inset-0 w-full h-full object-cover object-top /* Cover and align top */
                                    transition-[scale,opacity] duration-500 ease-out /* Tailwind v4 animates the scale property (not transform), so scale must be named here or the zoom snaps */
                                    [@media(hover:hover)]:[will-change:transform] /* Persistent GPU layer on hover-capable devices only — keeps the zoom smooth without thrashing iOS layers */
                                    group-hover:scale-105 group-hover:duration-300 /* Hover zoom (desktop only) */
                                    ${isVisible ? 'scale-100' : 'scale-[0.97]'} /* Entrance scale state for transition */
                                    ${loaded ? 'opacity-100' : 'opacity-0'} /* Fade in from placeholder once decoded */
                                    ${isPopcornPod ? POPCORN_POD_POSTER_FILTER : ''} /* Cheapened treatment for a non-selection */
                                `}
                                onLoad={() => setLoaded(true)}
                                onError={(e) => {
                                    e.currentTarget.src = '/placeholder-poster.png';
                                    setLoaded(true);
                                }} // Fallback image
                            />
                        )}

                        {/* Popcorn Pod sash — folded around the poster's top-left
                            corner. Along with the Up Next ribbon it is the only thing
                            allowed to sit on the artwork: the year, selector and watch
                            date read as text in the meta strip below, the way the
                            detail page sets them, rather than as blurred badges over a
                            scrim laid down purely to make them legible. That also
                            keeps three backdrop-blur layers per card out of iOS's
                            compositing budget during scroll. */}
                        {isPopcornPod && <PopcornPodStamp />}
                    </div>

                    {/* Card Content Section: Below poster, contains text info - NOT shown in poster-only mode */}
                    {!isPosterOnly && (
                        <div
                            className={`flex flex-col flex-grow ${isCompact ? 'p-1.5' : 'p-2'} bg-slate-800/40 border-t border-white/[0.06]`}
                        >
                            {/* Film Title. Hover brightens rather than turning blue:
                                saturated blue is reserved for data (club average,
                                genre chips), not for hover feedback — the card's
                                border carries the accent instead. */}
                            <h3
                                className={`
                                font-normal text-slate-300 truncate leading-tight tracking-wide
                                group-hover:text-slate-100 transition-colors duration-200
                                ${isCompact ? 'text-xs' : 'text-sm'}
                            `}
                            >
                                {film.title}
                                {film.year && (
                                    <span className="ml-1.5 text-slate-500">{film.year}</span>
                                )}
                            </h3>

                            {/* Who picked it, and when the club watched it — one quiet
                                typographic line in the same micro-label idiom the
                                detail page uses for its field headings. */}
                            {(selectorName || watchDateFormatted) && (
                                <div
                                    className={`
                                    mt-1 flex items-center gap-1.5 uppercase tracking-widest text-slate-500
                                    ${isCompact ? 'text-[9px]' : 'text-[10px]'}
                                `}
                                >
                                    {selectorName && (
                                        <>
                                            <span className="w-1 h-1 rounded-full flex-shrink-0 bg-emerald-400/80"></span>
                                            <span className="truncate">{selectorName}</span>
                                        </>
                                    )}
                                    {selectorName && watchDateFormatted && (
                                        <span className="text-slate-700" aria-hidden="true">
                                            /
                                        </span>
                                    )}
                                    {watchDateFormatted && (
                                        <span className="font-mono tracking-normal">
                                            {watchDateFormatted}
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Conditional Content Area: Ratings OR Film Info */}
                            <div className={`mt-auto ${isCompact ? 'pt-1.5' : 'pt-2'}`}>
                                {showUpNext ? (
                                    // --- RENDER IF "UP NEXT" ---
                                    <div
                                        className={`grid grid-cols-2 gap-x-2 gap-y-0.5 ${isCompact ? 'text-[10px]' : 'text-xs'}`}
                                    >
                                        {/* Director */}
                                        {film.director && film.director !== 'N/A' && (
                                            <div
                                                className="flex items-center text-slate-400 truncate col-span-2"
                                                title="Director"
                                            >
                                                <UserIcon
                                                    className={`mr-1 text-slate-500 flex-shrink-0 ${isCompact ? 'w-2 h-2' : 'w-2.5 h-2.5'}`}
                                                />
                                                <span className="truncate">
                                                    {film.director.split(',')[0]}
                                                </span>
                                            </div>
                                        )}
                                        {/* Country */}
                                        {film.language && film.country !== 'N/A' && (
                                            <div
                                                className="flex items-center text-slate-400 col-span-2"
                                                title="Country"
                                            >
                                                <GlobeEuropeAfricaIcon
                                                    className={`mr-1 text-slate-500 flex-shrink-0 ${isCompact ? 'w-2 h-2' : 'w-2.5 h-2.5'}`}
                                                />
                                                <span className="text-slate-500 truncate">
                                                    {film.country}
                                                </span>
                                            </div>
                                        )}
                                        {/* Fallback if no info */}
                                        {(!film.genre || film.genre === 'N/A') &&
                                            (!film.director || film.director === 'N/A') &&
                                            (!film.imdbRating || film.imdbRating === 'N/A') && (
                                                <div className="text-slate-500 text-[10px] italic col-span-2">
                                                    More info coming soon...
                                                </div>
                                            )}
                                    </div>
                                ) : (
                                    // --- RENDER IF WATCHED ---
                                    <>
                                        {/* Member Ratings Display */}
                                        {ratingEntries.length > 0 && (
                                            <div
                                                className={`flex flex-wrap items-stretch gap-1 ${isCompact ? 'gap-0.5' : 'gap-1'}`}
                                            >
                                                {ratingEntries.map((rating) => {
                                                    const numericRating = rating.score as number;
                                                    const ratingColorClass =
                                                        getRatingColorClass(numericRating);
                                                    return (
                                                        <div
                                                            key={rating.user}
                                                            title={
                                                                rating.scoreQualifier
                                                                    ? `${rating.user}: ${rating.score}/9 (${rating.scoreQualifier} — a ${rating.scoreQualifier === 'd' ? 'documentary' : 'qualified'} score; see the film page)`
                                                                    : `${rating.user}: ${rating.score}/9`
                                                            }
                                                            className={`
                                                                flex flex-col items-center justify-center flex-1 basis-0 min-w-0 max-w-10
                                                                text-center bg-white/[0.04] rounded-md ring-1 ring-inset ring-white/[0.06]
                                                                transition-colors duration-150 ease-out hover:bg-white/[0.08]
                                                                ${isCompact ? 'py-0.5' : 'py-1'}
                                                            `}
                                                        >
                                                            {/* Member Initials */}
                                                            <div
                                                                className={`uppercase font-mono text-slate-400 leading-none tracking-widest whitespace-nowrap ${isCompact ? 'text-[8px]' : 'text-[9px]'}`}
                                                            >
                                                                {rating.user.substring(0, 2)}
                                                            </div>
                                                            {/* Member Rating */}
                                                            <div
                                                                className={`font-mono font-bold leading-none whitespace-nowrap mt-0.5 ${ratingColorClass} ${isCompact ? 'text-[11px]' : 'text-sm'}`}
                                                            >
                                                                {rating.score}
                                                                {rating.scoreQualifier && (
                                                                    <span className="align-super text-[0.6em] text-amber-400/90 lowercase">
                                                                        {rating.scoreQualifier}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Club Average Rating Display — intentionally disabled toggle */}
                                        {/* eslint-disable-next-line no-constant-binary-expression */}
                                        {false &&
                                            clubAverageDisplay !== null &&
                                            clubAverageDisplay !== undefined &&
                                            ratingEntries.length > 0 && (
                                                <div
                                                    className={`w-full flex items-center justify-end text-xs text-slate-400 mt-2 ${isCompact ? 'mt-1.5 text-[10px]' : 'mt-2 text-xs'}`}
                                                >
                                                    <PopcornRating
                                                        rating={clubAverageDisplay as number}
                                                        maxRating={9}
                                                        size={isCompact ? 'small' : 'regular'}
                                                        showPartialFill={true}
                                                        title={`Average Club Rating: ${clubAverageDisplay?.toFixed(1)}/9`}
                                                        className="mr-auto opacity-70"
                                                    />
                                                </div>
                                            )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>{' '}
                {/* End Inner Card Div */}
            </Link>
        </div>
    );
};

export default FilmCard;
