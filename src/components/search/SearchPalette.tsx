import React, {
    useDeferredValue,
    useEffect,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import classNames from 'classnames';
import { useBodyScrollLock } from '@jekrch/react-viewport-lightbox';
import {
    ArrowTurnDownLeftIcon,
    ChartBarIcon,
    ChevronDownIcon,
    EyeIcon,
    FilmIcon,
    HomeIcon,
    MagnifyingGlassIcon,
    SparklesIcon,
    UserGroupIcon,
} from '@heroicons/react/24/outline';

import AnimatedHeight from '../common/AnimatedHeight';
import { resolveTrophyIcon, type IconComponent } from '../common/trophyIcons';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useModalPresence } from '../../hooks/useModalPresence';
import { ALL_MEMBERS, useWatchedLog } from '../../hooks/useWatchedLog';
import { DEFAULT_MEMBER_IMAGE, getMemberImage } from '../../types/team';
import { getRatingColorClass } from '../../utils/ratingUtils';
import {
    buildSearchIndex,
    highlightRuns,
    queryWords,
    searchIndex,
    searchSuggestions,
    type RankedResult,
    type SearchGroupKey,
    type SearchGroupResults,
    type SearchThumb,
} from '../../utils/globalSearch';

/**
 * The site-wide search: a command palette that opens over whatever page the
 * reader is on and answers with films, members, lists, logs, reviews, and
 * trophies (see `utils/globalSearch.ts` for what is searched and how it ranks).
 *
 * Its own shell rather than `Modal`'s, which is built around a title bar — a
 * palette's header *is* its field. It keeps everything else `Modal` promises:
 * the portal, the scroll lock, the same scrim and the same enter and exit, so
 * it reads as one of the site's dialogs and not as a widget dropped on top.
 */

/** Hits per group before "Show all". Enough to choose from; few enough to scan. */
const GROUP_LIMIT = 4;
/** How far "Show all" opens a group. A cap, so a one-letter query stays drawable. */
const EXPANDED_LIMIT = 30;

const PAGE_ICONS: Record<string, IconComponent> = {
    home: HomeIcon as IconComponent,
    films: FilmIcon as IconComponent,
    log: EyeIcon as IconComponent,
    almanac: ChartBarIcon as IconComponent,
    retrospective: SparklesIcon as IconComponent,
    about: UserGroupIcon as IconComponent,
};

/** One row the arrow keys can land on. */
type PaletteItem =
    | { kind: 'result'; id: string; result: RankedResult }
    | { kind: 'more'; id: string; group: SearchGroupKey; hidden: number };

/** The query's words, lit where they appear. */
const Highlight: React.FC<{ text: string; words: string[] }> = ({ text, words }) => (
    <>
        {highlightRuns(text, words).map((run, index) =>
            run.match ? (
                <mark key={index} className="rounded-[2px] bg-blue-400/15 text-blue-100">
                    {run.text}
                </mark>
            ) : (
                <React.Fragment key={index}>{run.text}</React.Fragment>
            )
        )}
    </>
);

const MemberAvatar: React.FC<{ name: string }> = ({ name }) => {
    const [failed, setFailed] = useState(false);
    return (
        <img
            src={failed ? DEFAULT_MEMBER_IMAGE : getMemberImage(name)}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className="h-9 w-9 rounded-full bg-slate-800 object-cover ring-1 ring-white/10"
        />
    );
};

const Thumb: React.FC<{ thumb: SearchThumb }> = ({ thumb }) => {
    const [failed, setFailed] = useState(false);

    if (thumb.kind === 'avatar') return <MemberAvatar name={thumb.name} />;

    if (thumb.kind === 'poster') {
        return thumb.src && !failed ? (
            <img
                src={thumb.src}
                alt=""
                loading="lazy"
                decoding="async"
                onError={() => setFailed(true)}
                className="h-12 w-8 rounded-[3px] bg-slate-800 object-cover shadow-md shadow-black/40 ring-1 ring-white/10"
            />
        ) : (
            <span className="flex h-12 w-8 items-center justify-center rounded-[3px] bg-slate-800 ring-1 ring-white/5">
                <FilmIcon className="h-4 w-4 text-slate-600" aria-hidden="true" />
            </span>
        );
    }

    const isTrophy = thumb.key.startsWith('trophy:');
    const Icon = isTrophy
        ? resolveTrophyIcon(thumb.key.slice('trophy:'.length))
        : (PAGE_ICONS[thumb.key] ?? (MagnifyingGlassIcon as IconComponent));
    return (
        <span
            className={classNames(
                'flex h-9 w-9 items-center justify-center rounded-lg ring-1',
                isTrophy
                    ? 'bg-amber-400/[0.08] text-amber-300/90 ring-amber-400/20'
                    : 'bg-slate-800/80 text-slate-300 ring-white/10'
            )}
        >
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
    );
};

interface ResultRowProps {
    id: string;
    result: RankedResult;
    words: string[];
    active: boolean;
    onHover: (event: React.MouseEvent) => void;
    onPick: () => void;
}

const ResultRow: React.FC<ResultRowProps> = ({ id, result, words, active, onHover, onPick }) => (
    // A real link, so a middle click or ⌘-click opens it in a new tab the way
    // the reader expects of anything that goes somewhere.
    <Link
        id={id}
        to={result.href}
        role="option"
        aria-selected={active}
        tabIndex={-1}
        onMouseMove={onHover}
        onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
            onPick();
        }}
        className={classNames(
            'group relative flex scroll-my-2 items-center gap-3 rounded-lg px-2.5 py-2 outline-none transition-colors duration-100',
            active ? 'bg-slate-800/80' : 'hover:bg-slate-800/40'
        )}
    >
        {/* The active row's edge, in the nav's own underline blue. */}
        <span
            className={classNames(
                'absolute inset-y-2 left-0 w-0.5 rounded-full bg-blue-400/70 transition-opacity duration-150',
                active ? 'opacity-100' : 'opacity-0'
            )}
            aria-hidden="true"
        />

        <span className="flex w-9 shrink-0 justify-center">
            <Thumb thumb={result.thumb} />
        </span>

        <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-baseline gap-1.5">
                <span className="truncate text-sm font-medium text-slate-100">
                    <Highlight text={result.title} words={words} />
                </span>
                {result.titleSuffix && (
                    <span className="shrink-0 text-xs tabular-nums text-slate-500">
                        {result.titleSuffix}
                    </span>
                )}
                {result.badge && (
                    <span className="shrink-0 self-center rounded border border-blue-400/30 bg-blue-400/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.12em] text-blue-200">
                        {result.badge}
                    </span>
                )}
            </span>

            {result.meta.length > 0 && (
                <span className="mt-0.5 block truncate text-xs text-slate-400">
                    {result.meta.map((part, index) => (
                        <React.Fragment key={index}>
                            {index > 0 && (
                                <span className="mx-1.5 text-slate-600" aria-hidden="true">
                                    ·
                                </span>
                            )}
                            <Highlight text={part} words={words} />
                        </React.Fragment>
                    ))}
                </span>
            )}

            {result.context && (
                <span className="mt-1 block truncate text-xs text-slate-500">
                    <span className="text-slate-400/80">{result.context.label}</span>{' '}
                    <Highlight text={result.context.text} words={words} />
                </span>
            )}

            {result.quote && (
                <span className="mt-1 line-clamp-2 border-l border-slate-700 pl-2 text-xs italic leading-relaxed text-slate-400">
                    <Highlight text={result.quote} words={words} />
                </span>
            )}
        </span>

        {result.score && (
            <span className="flex shrink-0 flex-col items-end">
                <span
                    className={classNames(
                        'text-sm font-semibold tabular-nums',
                        getRatingColorClass(result.score.numeric)
                    )}
                >
                    {result.score.value}
                </span>
                <span className="text-[9px] uppercase tracking-[0.12em] text-slate-500">
                    {result.score.label}
                </span>
            </span>
        )}

        <ArrowTurnDownLeftIcon
            className={classNames(
                'hidden h-4 w-4 shrink-0 text-slate-500 transition-opacity duration-150 sm:block',
                active ? 'opacity-100' : 'opacity-0'
            )}
            aria-hidden="true"
        />
    </Link>
);

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <kbd className="inline-flex min-w-[1.25rem] items-center justify-center rounded border border-slate-700 bg-slate-800/70 px-1 py-px font-sans text-[10px] leading-4 text-slate-400">
        {children}
    </kbd>
);

interface BodyProps {
    closing: boolean;
    onClose: () => void;
}

/**
 * The palette while it is on screen. Mounted only then, so the members' logs
 * are fetched on the first open rather than on every page load, and every open
 * starts from an empty field.
 */
const PaletteBody: React.FC<BodyProps> = ({ closing, onClose }) => {
    const navigate = useNavigate();
    const inputRef = useRef<HTMLInputElement>(null);
    const listId = useId();
    const optionPrefix = useId();

    const [query, setQuery] = useState('');
    const deferredQuery = useDeferredValue(query);
    const [expanded, setExpanded] = useState<Set<SearchGroupKey>>(new Set());
    const [activeIndex, setActiveIndex] = useState(0);
    // The full hint only where it fits on one line with room to spare.
    const roomyField = useMediaQuery('(min-width: 640px)');

    const { log, failed } = useWatchedLog(ALL_MEMBERS);
    const loadingLogs = log === null && !failed;

    // Rebuilt once when the logs land; everything else in it is bundled.
    const docs = useMemo(() => buildSearchIndex({ watched: log }), [log]);
    const words = useMemo(() => queryWords(deferredQuery), [deferredQuery]);
    const searching = words.length > 0;
    const groups: SearchGroupResults[] = useMemo(
        () => (searching ? searchIndex(docs, deferredQuery) : searchSuggestions(docs)),
        [docs, deferredQuery, searching]
    );
    const total = groups.reduce((sum, group) => sum + group.results.length, 0);

    // The rows on screen, group by group, with each group's "Show all" as a row
    // of its own so the keyboard can reach it too.
    const sections = useMemo(
        () =>
            groups.map((group) => {
                const limit = !searching
                    ? group.results.length
                    : expanded.has(group.key)
                      ? EXPANDED_LIMIT
                      : GROUP_LIMIT;
                const shown = group.results.slice(0, limit);
                const items: PaletteItem[] = shown.map((result) => ({
                    kind: 'result',
                    id: `${optionPrefix}-${result.id}`,
                    result,
                }));
                const hidden = group.results.length - shown.length;
                if (hidden > 0 && !expanded.has(group.key)) {
                    items.push({
                        kind: 'more',
                        id: `${optionPrefix}-more-${group.key}`,
                        group: group.key,
                        hidden,
                    });
                }
                return { group, items };
            }),
        [groups, expanded, searching, optionPrefix]
    );
    const items = useMemo(() => sections.flatMap((section) => section.items), [sections]);
    const active = items[Math.min(activeIndex, items.length - 1)];

    const listRef = useRef<HTMLDivElement>(null);

    // A new query starts back at the top, with every group folded.
    useEffect(() => {
        setActiveIndex(0);
        setExpanded(new Set());
        if (listRef.current) listRef.current.scrollTop = 0;
    }, [deferredQuery]);

    /**
     * Set by the arrow keys, and only by them: the list follows the keyboard's
     * row, never the pointer's. Following the pointer's fights the reader —
     * wheel past the edge of a half-shown row and it lights up under the
     * cursor, the list jumps to show it, and the next row lights up in turn.
     */
    const followActive = useRef(false);

    useLayoutEffect(() => {
        if (!active || !followActive.current) return;
        followActive.current = false;
        document.getElementById(active.id)?.scrollIntoView?.({ block: 'nearest' });
    }, [active]);

    /**
     * Where the pointer last was. Browsers fire `mousemove` at a still cursor
     * when the content under it scrolls; only a pointer that actually moved
     * should pick a row, or scrolling with the wheel drags the highlight along.
     */
    const lastPointer = useRef<{ x: number; y: number } | null>(null);
    const hoverTo = (index: number, event: React.MouseEvent) => {
        const last = lastPointer.current;
        lastPointer.current = { x: event.clientX, y: event.clientY };
        if (last && last.x === event.clientX && last.y === event.clientY) return;
        setActiveIndex(index);
    };

    // Focus in on open and back where it was on close, as `Modal` does.
    useEffect(() => {
        const previouslyFocused = document.activeElement as HTMLElement | null;
        inputRef.current?.focus();
        return () => previouslyFocused?.focus?.();
    }, []);

    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onCloseRef.current();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const pick = (item: PaletteItem | undefined) => {
        if (!item) return;
        if (item.kind === 'more') {
            setExpanded((current) => new Set(current).add(item.group));
            return;
        }
        onClose();
        navigate(item.result.href);
    };

    const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        const count = items.length;
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                followActive.current = true;
                if (count) setActiveIndex((index) => (Math.min(index, count - 1) + 1) % count);
                break;
            case 'ArrowUp':
                event.preventDefault();
                followActive.current = true;
                if (count)
                    setActiveIndex((index) => (Math.min(index, count - 1) - 1 + count) % count);
                break;
            case 'Enter':
                event.preventDefault();
                if (active?.kind === 'result' && (event.metaKey || event.ctrlKey)) {
                    window.open(active.result.href, '_blank', 'noopener');
                    return;
                }
                pick(active);
                break;
            case 'Tab':
                // Everything here is reachable from the field; the trap is the
                // field itself.
                event.preventDefault();
                break;
        }
    };

    // Only a press that both started and ended on the scrim closes it, as in `Modal`.
    const pressedOnOverlay = useRef(false);

    let itemIndex = -1;

    return (
        <div
            className={classNames(
                'fixed inset-0 z-50 flex items-start justify-center bg-slate-950/75 backdrop-blur-[3px]',
                'px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:pt-[12vh]',
                closing
                    ? 'pointer-events-none animate-modal-backdrop-out'
                    : 'animate-modal-backdrop-in'
            )}
            onMouseDown={(event) => {
                pressedOnOverlay.current = event.target === event.currentTarget;
            }}
            onClick={(event) => {
                if (event.target === event.currentTarget && pressedOnOverlay.current) onClose();
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Search the site"
                className={classNames(
                    'relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-700/60',
                    'bg-slate-900/95 shadow-2xl shadow-black/60 ring-1 ring-white/[0.06] backdrop-blur-xl',
                    closing ? 'animate-modal-panel-out' : 'animate-modal-panel-in'
                )}
            >
                {/* A hairline of light along the top edge, which is what lifts a
                    dark panel off a dark scrim more than any shadow does. */}
                <div
                    className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    aria-hidden="true"
                />

                <div className="flex items-center gap-3 border-b border-slate-800 px-4">
                    <MagnifyingGlassIcon
                        className="h-5 w-5 shrink-0 text-slate-500"
                        aria-hidden="true"
                    />
                    <input
                        ref={inputRef}
                        type="text"
                        role="combobox"
                        aria-expanded={items.length > 0}
                        aria-controls={listId}
                        aria-activedescendant={active?.id}
                        aria-autocomplete="list"
                        aria-label="Search films, members, lists, and reviews"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={onInputKeyDown}
                        placeholder={
                            roomyField
                                ? 'Search films, people, members, lists, reviews…'
                                : 'Search…'
                        }
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        enterKeyHint="go"
                        className="h-14 min-w-0 flex-1 bg-transparent text-base text-slate-100 placeholder:text-slate-500 focus:outline-none"
                    />
                    <button
                        type="button"
                        onClick={onClose}
                        tabIndex={-1}
                        className="shrink-0 rounded-md border border-slate-700 bg-slate-800/70 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400 outline-none transition-colors hover:border-slate-500 hover:text-slate-200 focus-visible:outline-none"
                        aria-label="Close search"
                    >
                        Esc
                    </button>
                </div>

                <AnimatedHeight>
                    <div
                        ref={listRef}
                        id={listId}
                        role="listbox"
                        aria-label="Results"
                        className="themed-scrollbar max-h-[calc(100dvh-9rem)] overflow-y-auto overscroll-contain px-2 pb-2 sm:max-h-[min(34rem,64vh)]"
                    >
                        {searching && total === 0 ? (
                            <div className="flex flex-col items-center px-6 py-12 text-center">
                                <MagnifyingGlassIcon
                                    className="mb-3 h-8 w-8 text-slate-700"
                                    aria-hidden="true"
                                />
                                <p className="text-sm text-slate-300">
                                    No results for “{deferredQuery.trim()}”
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                    Try a film, a director or actor, a member, or a word from a
                                    review.
                                </p>
                            </div>
                        ) : (
                            sections.map(({ group, items: groupItems }) => (
                                <div key={group.key} role="group" aria-label={group.label}>
                                    <div className="flex items-center justify-between px-2.5 pb-1.5 pt-3.5 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
                                        <span>{group.label}</span>
                                        {searching && (
                                            <span className="tabular-nums text-slate-600">
                                                {group.results.length}
                                            </span>
                                        )}
                                    </div>
                                    {groupItems.map((item) => {
                                        itemIndex += 1;
                                        const index = itemIndex;
                                        const isActive = active?.id === item.id;
                                        if (item.kind === 'more') {
                                            return (
                                                <button
                                                    key={item.id}
                                                    id={item.id}
                                                    type="button"
                                                    role="option"
                                                    aria-selected={isActive}
                                                    tabIndex={-1}
                                                    onMouseMove={(event) => hoverTo(index, event)}
                                                    onClick={() => pick(item)}
                                                    className={classNames(
                                                        'flex w-full scroll-my-2 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs outline-none transition-colors duration-100 focus-visible:outline-none',
                                                        isActive
                                                            ? 'bg-slate-800/80 text-slate-100'
                                                            : 'text-slate-400 hover:text-slate-200'
                                                    )}
                                                >
                                                    <ChevronDownIcon
                                                        className="h-3.5 w-3.5"
                                                        aria-hidden="true"
                                                    />
                                                    Show {item.hidden} more
                                                </button>
                                            );
                                        }
                                        return (
                                            <ResultRow
                                                key={item.id}
                                                id={item.id}
                                                result={item.result}
                                                words={words}
                                                active={isActive}
                                                onHover={(event) => hoverTo(index, event)}
                                                onPick={onClose}
                                            />
                                        );
                                    })}
                                </div>
                            ))
                        )}
                    </div>
                </AnimatedHeight>

                <div className="flex items-center justify-between gap-4 border-t border-slate-800 bg-slate-950/30 px-4 py-2 text-[11px] text-slate-500">
                    <div className="hidden items-center gap-3 sm:flex">
                        <span className="flex items-center gap-1">
                            <Kbd>↑</Kbd>
                            <Kbd>↓</Kbd>
                            <span className="ml-0.5">Navigate</span>
                        </span>
                        <span className="flex items-center gap-1">
                            <Kbd>↵</Kbd>
                            <span className="ml-0.5">Open</span>
                        </span>
                        <span className="flex items-center gap-1">
                            <Kbd>Esc</Kbd>
                            <span className="ml-0.5">Close</span>
                        </span>
                    </div>
                    <div className="ml-auto flex items-center gap-2" aria-live="polite">
                        {loadingLogs && (
                            <span className="flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400/70" />
                                Loading member logs
                            </span>
                        )}
                        {!loadingLogs && searching && (
                            <span className="tabular-nums">
                                {total} result{total === 1 ? '' : 's'}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

interface SearchPaletteProps {
    isOpen: boolean;
    onClose: () => void;
}

const SearchPalette: React.FC<SearchPaletteProps> = ({ isOpen, onClose }) => {
    const { isRendered, isClosing } = useModalPresence(isOpen);
    useBodyScrollLock(isRendered);

    if (!isRendered) return null;
    return createPortal(<PaletteBody closing={isClosing} onClose={onClose} />, document.body);
};

export default SearchPalette;
