import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid';
import { EyeIcon, FilmIcon, NumberedListIcon, QueueListIcon } from '@heroicons/react/24/outline';

import CircularImage from '../common/CircularImage';
import CollapsibleContent from '../common/CollapsableContent';
import RowFrameWash from '../common/RowFrameWash';
import EntryDetailsPanel, { EntryDetailsToggle } from '../films/EntryDetailsPanel';
import { resolveTrophyIcon, type IconComponent } from '../common/trophyIcons';
import { clubFilmDetails, type EntryDetails } from '../../utils/entryDetails';
import { getRatingColorClass } from '../../utils/ratingUtils';
import { MAX_SCORE } from '../../utils/ratingEditUtils';
import { formatWatchDate, watchedRowId } from '../../utils/watchedUtils';
import { isRankedList } from '../../types/list';
import type { CardAccent } from '../common/accents';
import type { ListEvent, TrophyEvent, WallEvent, WallRow } from '../../utils/wallUtils';
import {
    CLUB_PICK_NODE_CLASS,
    CLUB_PICK_ROW_CLASS,
    DATE_HOVER_CLASS,
    KIND_ACCENT,
    NODE_CLASS,
    NODE_PHOTO_CLASS,
    ROW_HOVER_CLASS,
} from './wallAccents';

/**
 * One box on the club's wall.
 *
 * Every kind wears the same box — a node on the timeline, a band naming when it
 * happened and who did it, the thing they did it to on the line below, and that
 * thing's art washed in from the right. What changes between them is the verb in
 * the band and the badge at the end of the line, and that is on purpose: the
 * wall's job is to be read straight down, and four layouts interleaved would
 * make the reader re-learn where to look on every row.
 *
 * The box is a sibling-of-links structure rather than one big link. A screening
 * names a film *and* the member who picked it, and an anchor inside an anchor is
 * invalid — the same reason the profile's list rows keep their edit link outside
 * the card link. What plays the part of the card link here is the poster, which
 * goes to wherever the record itself lives (see {@link eventHome}); the names
 * inside the sentence go to the people and things they name.
 *
 * A box can carry more than one record. The club hands out its trophies at the
 * screening, so `mergeTrophyRows` folds a night's awards into the screening they
 * were given at and they arrive here as {@link WallRow.trophies} — one poster
 * for the evening instead of one per award.
 */

interface WallEventRowProps {
    row: WallRow;
    /** False on the last box of the wall, which has nothing below to connect to. */
    connected: boolean;
}

/** The icon in the timeline node, per kind. A trophy gets its own award's icon. */
const nodeIcon = (event: WallEvent): IconComponent => {
    switch (event.kind) {
        case 'club-watch':
            return FilmIcon as IconComponent;
        case 'log':
            return EyeIcon as IconComponent;
        case 'list':
            return QueueListIcon as IconComponent;
        case 'trophy':
            // The film page's shelf draws the Togetherness Trophy as two
            // overlapping souls and the Bad Boy as sunglasses; a wall that fell
            // back to a generic cup would be the one place they lose their faces.
            return resolveTrophyIcon(event.trophy.award);
    }
};

/**
 * Where the record behind an event lives on this site.
 *
 * The wall records nothing of its own — every box is a view onto a row that is
 * already written somewhere with more room around it — so every box needs a way
 * back to that place. A screening and a trophy belong to a film, so both go to
 * the film's page. A log belongs to its member's own log rather than to the
 * film, and names the row it came from, so the log opens with that film in view
 * instead of at the top with no sign of where the click went — the same link the
 * profile's watch preview builds.
 */
const eventHome = (event: WallEvent): string => {
    switch (event.kind) {
        case 'club-watch':
        case 'trophy':
            return `/films/${event.film.imdbID}`;
        case 'log':
            return `/watched/${encodeURIComponent(event.member)}#${watchedRowId(event.entry.imdbID)}`;
        case 'list':
            return `/lists/${event.list.id}`;
    }
};

/** What that destination is called, for the link's accessible name and tooltip. */
const eventHomeLabel = (event: WallEvent): string => {
    switch (event.kind) {
        case 'club-watch':
        case 'trophy':
            return `${event.film.title} on the site`;
        case 'log':
            return `${event.entry.title ?? 'this film'} in ${event.member}'s log`;
        case 'list':
            return event.list.name;
    }
};

/**
 * The film a row is about: what its poster shows, what its expander opens, and
 * what both of those are labelled with.
 *
 * Null for a list, which is about several films and has no one of them to draw
 * — the row's poster slot and its expander are both absent there for the same
 * reason, so they ask this one question rather than each testing the kind.
 */
const rowFilm = (
    event: WallEvent
): { imdbID: string; title: string; poster: string | null } | null => {
    switch (event.kind) {
        case 'log':
            return {
                imdbID: event.entry.imdbID,
                title: event.entry.title ?? 'Unknown film',
                poster: event.entry.poster,
            };
        case 'club-watch':
        case 'trophy':
            return {
                imdbID: event.film.imdbID,
                title: event.film.title,
                poster: event.film.poster,
            };
        case 'list':
            return null;
    }
};

/**
 * What a row can open out about its film — tagline, synopsis, credits, external
 * scores, stills, cast — or null when nothing knows anything worth expanding.
 *
 * The same panel the watch log and the list rows carry, and here for the same
 * reason: a wall row said a title, a year and a poster, and half of what's on
 * this wall is a film the club never watched and so has no page on this site to
 * follow the title to. A log's entry has already resolved its own details —
 * against the club film where there is one, the summary cache otherwise — while
 * a screening or a trophy resolves the club film it names.
 *
 * Resolved per render rather than on first open, because the answer is also what
 * decides whether the row gets an expander at all.
 */
const rowDetails = (event: WallEvent): EntryDetails | null => {
    switch (event.kind) {
        case 'log':
            return event.entry.details;
        case 'club-watch':
        case 'trophy':
            return clubFilmDetails(event.film);
        case 'list':
            return null;
    }
};

/**
 * True when {@link WallFigure} will draw something.
 *
 * Asked one line above where the badge is rendered, because the figure and the
 * expander share a cluster at the end of the subject and the cluster shouldn't
 * exist when neither does.
 */
const hasFigure = (event: WallEvent): boolean =>
    (event.kind === 'club-watch' && event.average !== null) ||
    (event.kind === 'log' && event.entry.score !== null) ||
    event.kind === 'list';

/**
 * A member, as a chip linking to their profile.
 *
 * Deliberately neutral rather than accent-tinted. A wall row already carries its
 * accent on the node and its border, and up to six of these can sit in one
 * screenful — the reasoning `Button`'s chip variant gives for not filling a
 * segmented control with color applies with more force here.
 *
 * `photo={false}` drops the face and keeps the link, for the one place a face
 * would be the second copy of itself: a log's owner, whose portrait is already
 * filling the node an inch to the left (see {@link TimelineNode}).
 */
const MemberChip: React.FC<{ name: string; photo?: boolean }> = ({ name, photo = true }) => (
    <Link
        to={`/profile/${encodeURIComponent(name)}`}
        title={`View ${name}'s profile`}
        className={`group/member -my-0.5 inline-flex items-center gap-1.5 rounded-md bg-slate-700/50 py-0.5 pr-2 align-middle ring-1 ring-slate-600/40 transition-colors duration-150 hover:bg-slate-700/80 hover:ring-slate-500/60 ${
            photo ? 'pl-0.5' : 'pl-2'
        }`}
    >
        {photo && (
            <span className="rounded-full ring-1 ring-slate-500/40">
                <CircularImage alt={name} size="w-5 h-5" />
            </span>
        )}
        <span className="font-medium text-slate-200 group-hover/member:text-slate-100">{name}</span>
    </Link>
);

/**
 * The circle the timeline hangs the row from.
 *
 * A log's is the member's own portrait, and that is this component's whole
 * reason to exist. The node is where the wall puts the most specific thing it
 * knows about an event — which is why a trophy's node is the award's own icon
 * rather than a generic cup — and the most specific thing about a log is not
 * that somebody logged something, it is *who*. The score is theirs, the review
 * is theirs, and the record counts toward nothing but their own log; a shared
 * eye icon on every one of them was the row saying the least it could.
 *
 * It also gives the gutter a job it wasn't doing. Faces run down the rail where
 * a repeated glyph used to, so "what has Gabe been watching" is answerable by
 * scanning a column rather than by reading every sentence.
 *
 * The club's own screenings keep their film icon: a screening belongs to the
 * club rather than to whoever picked it, and hanging one member's face off it
 * would file the evening under them.
 */
const TimelineNode: React.FC<{ event: WallEvent; accent: CardAccent }> = ({ event, accent }) => {
    /**
     * The node stands at the head of the row's caption line, which is sized to
     * hold it. Below `sm` that line is all it has: a 44px lane down the left of
     * a phone is a quarter of the row spent on a 32px circle, and the title is
     * what that width was for, so the gutter goes and the boxes start at the
     * screen's own edge. The node keeps its column either way — every one at
     * the same x, straight down the page.
     */
    const position = 'absolute left-0 top-0 h-8 w-8 sm:h-9 sm:w-9';

    if (event.kind === 'log') {
        return (
            // `group` of its own: the node sits outside the row's article, so
            // CircularImage's hover zoom has nothing to key off otherwise.
            <Link
                to={`/profile/${encodeURIComponent(event.member)}`}
                title={`View ${event.member}'s profile`}
                className={`group ${position} block rounded-full ring-1 transition duration-200 ${NODE_PHOTO_CLASS[accent]}`}
            >
                <CircularImage alt={event.member} size="h-full w-full" />
            </Link>
        );
    }

    const Icon = nodeIcon(event);
    return (
        <span
            className={`${position} flex items-center justify-center rounded-full ring-1 ${
                // The club's own night gets the lit node, for the reason
                // CLUB_PICK_ROW_CLASS gives. Same circle, same recipe, brighter.
                event.kind === 'club-watch' ? CLUB_PICK_NODE_CLASS : NODE_CLASS[accent]
            }`}
            aria-hidden="true"
        >
            <Icon
                className={event.kind === 'club-watch' ? 'h-[1.125rem] w-[1.125rem]' : 'h-4 w-4'}
            />
        </span>
    );
};

/**
 * A film's title, linking wherever that film lives.
 *
 * The rule is the watch log's: a film the club watched has a page here, and
 * anything else goes out to IMDb — marked as leaving, since a wall mixes the two
 * freely and the reader shouldn't have to guess which they're about to follow.
 */
const FilmTitle: React.FC<{
    imdbID: string;
    title: string | null;
    year: string | null;
    onSite: boolean;
    /** A club pick's title, set a step above the sentence it sits in. */
    emphasis?: boolean;
}> = ({ imdbID, title, year, onSite, emphasis = false }) => {
    const displayTitle = title ?? 'Unknown film';
    const body = (
        <>
            {displayTitle}
            {year && <span className="ml-1.5 font-normal text-slate-500">{year}</span>}
            {!onSite && (
                <ArrowTopRightOnSquareIcon
                    className="ml-1 inline h-3 w-3 align-baseline text-slate-600"
                    aria-hidden="true"
                />
            )}
        </>
    );
    const className = `transition-colors hover:text-white hover:underline decoration-slate-600 underline-offset-4 ${
        emphasis ? 'text-[1.0625rem] font-semibold text-slate-100' : 'font-medium text-slate-200'
    }`;

    return onSite ? (
        <Link to={`/films/${imdbID}`} className={className}>
            {body}
        </Link>
    ) : (
        <a
            href={`https://www.imdb.com/title/${imdbID}/`}
            target="_blank"
            rel="noopener noreferrer"
            className={className}
        >
            {body}
        </a>
    );
};

/**
 * The row's poster, at a poster's own 2:3.
 *
 * Sized as the watch log sizes its own — artwork rather than an icon — but a
 * step down at each breakpoint, because a wall row carries the timeline's node
 * and rail to its left and gives up 3rem of a phone's width before it starts.
 * Both are exact 2:3, which is the one constraint here: a poster off its own
 * ratio either letterboxes or crops the title off the top.
 *
 * A dead URL falls back to the empty frame rather than swapping `src`, which can
 * re-fire the handler forever — the same guard the watch log and the list rows
 * carry, and for the same reason: half of what's on this wall is an OMDB row
 * nobody vetted.
 */
const POSTER_CLASS = 'h-21 w-14 sm:h-27 sm:w-18';

const EventPoster: React.FC<{ src: string | null; title: string }> = ({ src, title }) => {
    const [failed, setFailed] = useState(false);

    if (!src || failed) {
        return (
            <span
                className={`flex ${POSTER_CLASS} items-center justify-center rounded-md bg-slate-800 text-[10px] uppercase tracking-widest text-slate-600 ring-1 ring-slate-600/40`}
                aria-hidden="true"
            >
                ?
            </span>
        );
    }

    return (
        <img
            src={src}
            alt={`${title} poster`}
            loading="lazy"
            decoding="async"
            className={`block ${POSTER_CLASS} rounded-md object-cover object-top shadow-sm shadow-black/40 ring-1 ring-slate-600/40`}
            onError={() => setFailed(true)}
        />
    );
};

/** The club's scale, which members use for their own watches too. */
const ScoreBadge: React.FC<{
    score: number;
    qualifier?: string | null;
    title: string;
}> = ({ score, qualifier, title }) => (
    <span
        className="rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-xs ring-1 ring-inset ring-white/[0.06]"
        title={title}
    >
        <span className={getRatingColorClass(score)}>{score}</span>
        {qualifier && <span className="text-slate-400">{qualifier}</span>}
        <span className="text-slate-500">/{MAX_SCORE}</span>
    </span>
);

/**
 * Secondary prose under the subject — a review, a note, a list's blurb.
 *
 * Railed rather than merely greyed: the line under a subject is the one place
 * on this wall where somebody is talking rather than something being recorded,
 * which is the distinction the emerald rail draws everywhere else, and which is
 * how the watch log draws a review.
 *
 * Clamped to two lines with the site's own collapsible under it, so a long
 * review doesn't push six other events off the screen but is still readable
 * where it was written — the wall is meant to be read straight down, and a
 * reader who wants the rest of a paragraph shouldn't have to leave for the
 * member's log to get it. `CollapsibleContent` measures, so the toggle appears
 * only on prose that is actually cut off.
 *
 * `whitespace-pre-line` for the reason `Markdown` carries `remark-breaks`: all
 * of this prose is typed into a plain `<textarea>`, and a member who pressed
 * Enter meant it. HTML collapses those newlines to spaces, so a review that
 * broke into lines on its author's log arrived here as one run-on paragraph —
 * the same words laid out two different ways in two places. Blank lines still
 * read as a gap, and wrapping is untouched, so the clamp still counts the lines
 * the reader actually sees.
 */
const Detail: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="relative mt-1.5 border-l-2 border-emerald-400/30 pl-3">
        <CollapsibleContent
            lineClamp={2}
            buttonSize="sm"
            buttonTexts={{ more: 'Read more', less: 'Read less' }}
            buttonClassName="not-italic mt-1"
            className="whitespace-pre-line text-sm leading-relaxed text-slate-300"
        >
            {children}
        </CollapsibleContent>
    </div>
);

const WallEventRow: React.FC<WallEventRowProps> = ({ row, connected }) => {
    const { lead, trophies } = row;
    const accent = KIND_ACCENT[lead.kind];
    /** A list has no single film, so its poster slot and its expander are both absent. */
    const film = rowFilm(lead);
    /** The club's own screening, which the wall draws with more weight than the rest. */
    const clubPick = lead.kind === 'club-watch';

    const details = useMemo(() => rowDetails(lead), [lead]);
    const [detailsOpen, setDetailsOpen] = useState(false);
    // Keyed by the row rather than by the film: a screening and a member's log
    // of the same film can sit on one page, and two panels sharing an `id` would
    // point every one of their toggles at whichever came first.
    const panelId = `wall-details-${row.id}`;

    return (
        // `group` on the row rather than on the card: the caption and the node
        // now stand outside the box, and a row that lit only the part the cursor
        // happened to be over would read as three things stacked rather than as
        // one event.
        <li className="group relative sm:pl-14">
            {/* The rail runs from under this node to the next one rather than
                behind them all, so a node needs no fill of its own to punch
                through it — which matters on a page whose background is a
                gradient and has no single shade to paint with.

                From `sm` up it has the gutter to run down, and it runs the
                whole way — out past the row's own bottom and into the gap, so
                it meets the next node rather than stopping short of it.

                On a phone there is no gutter: the boxes start at the screen's
                own edge, and a line between the nodes would have to cross every
                box it was meant to connect. So it shortens to that same gap — a
                stub under the node, picking the thread back up between one row
                and the next. */}
            {connected && (
                <span
                    className="absolute left-4 top-full h-4 w-px bg-slate-700/50 sm:-bottom-4 sm:left-[1.125rem] sm:top-11 sm:h-auto"
                    aria-hidden="true"
                />
            )}
            <TimelineNode event={lead} accent={accent} />

            {/* The event is the caption *and* the box, so the article is both.
                What the box has of its own is a surface — a border, a wash, and
                the padding they need — and a caption sitting inside that surface
                is what this row spent two passes getting out of. */}
            <article>
                {/* When it happened and who did it, on the node's own line above
                    the box. Inside it, the sentence was competing for the same
                    column as the title and the poster; out here it has the row's
                    full width and the box below it starts clean.

                    `min-h-8` is exactly a node, so the circle has a line to sit
                    on rather than an edge to hang off, and `pl-10` clears it.
                    From `sm` the row's own `pl-14` has already done that. */}
                <div className="mb-1.5 flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1 pl-10 text-sm text-slate-400 sm:min-h-9 sm:pl-0">
                    {/* The wall is ordered by when, so the date leads the row —
                        at the same place under the same edge on every one of
                        them, which is what makes dates scannable. */}
                    <time
                        dateTime={lead.date}
                        className={`text-xs uppercase tracking-widest tabular-nums text-slate-500 transition-colors duration-200 ${DATE_HOVER_CLASS[accent]}`}
                    >
                        {formatWatchDate(lead.date)}
                    </time>
                    <WallActor event={lead} />
                </div>

                <div
                    className={`relative overflow-hidden rounded-xl border p-3 transition-colors duration-200 sm:p-4 ${
                        clubPick
                            ? CLUB_PICK_ROW_CLASS
                            : `border-slate-600/30 bg-slate-700/25 group-hover:bg-slate-700/45 ${ROW_HOVER_CLASS[accent]}`
                    }`}
                >
                    <RowFrameWash image={lead.wash} />

                    {/* The club pick's spine, drawn after the wash so the art never
                        passes over it. A painted bar rather than a `border-l-2`,
                        because a border can only be one flat color and this one
                        fades out down the row — and because a flat 2px left rail is
                        already spoken for on this wall: it is what `Detail` draws in
                        emerald when somebody is talking. Inside the article's own
                        rounded clip, so it takes the corner radius with it. */}
                    {clubPick && (
                        <span
                            className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-blue-400/80 via-blue-400/45 to-blue-400/10"
                            aria-hidden="true"
                        />
                    )}

                    {/* A grid rather than a flex row, and the watch log's grid: on a
                        wide screen the prose belongs beside the poster in the
                        subject's column, and on a phone that column is barely
                        150px once the timeline and the poster have taken theirs,
                        which turns a review into a ribbon of three-word lines.
                        Spanning the full width down there is a change of placement,
                        not of markup — which a flex row would need two copies of. */}
                    {/* `grid-rows-[auto_1fr]` is what keeps the review still
                        when it opens. The poster spans both rows, and when it is
                        taller than they are, grid hands the surplus to every
                        spanned auto track *equally* — so half of it lands in the
                        title's row and pushes the review down. Open the review
                        and the rows outgrow the poster, that half disappears,
                        and the two lines the reader was already looking at jump
                        up by it. Naming the second track `1fr` sends the whole
                        surplus there instead: the title's row is only ever as
                        tall as the title, and the prose under it starts at the
                        same place open or shut. Only from `sm`, which is where
                        the poster starts spanning. */}
                    <div className="relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-start sm:grid-rows-[auto_1fr]">
                        {film && (
                            <Link
                                to={eventHome(lead)}
                                title={`Open ${eventHomeLabel(lead)}`}
                                className="col-start-1 row-start-1 block rounded-md transition-opacity duration-200 hover:opacity-80 sm:row-span-2"
                            >
                                <EventPoster src={film.poster} title={film.title} />
                            </Link>
                        )}

                        {/* The score travels at the end of the subject rather than in
                            a column of its own at the row's edge — the watch log's
                            arrangement, and the one that leaves the title its full
                            width on a phone instead of squeezing it between a poster
                            and a badge. */}
                        <div
                            className={`col-start-2 row-start-1 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1.5 leading-relaxed text-slate-400${
                                film ? ' ml-3 sm:ml-4' : ''
                            }`}
                        >
                            <WallSubject event={lead} />

                            {/* The score and the expander travel together at the
                                end of the line, so the pair moves as one when
                                the title wraps — the watch log's arrangement,
                                and the reason the `ml-auto` is out here rather
                                than on each of them: two of those would each
                                claim the free space and split apart. */}
                            {(hasFigure(lead) || details) && (
                                <span className="ml-auto flex flex-shrink-0 items-center gap-1.5">
                                    <WallFigure event={lead} />

                                    {/* Last in the cluster: the badge before it
                                        is a label, this is the one that acts on
                                        the row. */}
                                    {details && film && (
                                        <EntryDetailsToggle
                                            isOpen={detailsOpen}
                                            onToggle={() => setDetailsOpen((open) => !open)}
                                            title={film.title}
                                            panelId={panelId}
                                        />
                                    )}
                                </span>
                            )}
                        </div>

                        <ListPosters event={lead} />

                        {/* Full width beneath everything on a phone, back in the
                            subject's column from `sm` up. */}
                        <div
                            className={`col-span-3 col-start-1 row-start-2 min-w-0 sm:col-span-1 sm:col-start-2${
                                film ? ' sm:ml-4' : ''
                            }`}
                        >
                            <WallDetail event={lead} />
                            <FoldedTrophies trophies={trophies} />
                        </div>
                    </div>

                    {/* Across the whole box rather than in the subject's column:
                        this is the film's own description, not anybody's word
                        about it, and its stills want the width. `relative` to
                        stack it above the wash, as everything else here is. */}
                    {details && film && (
                        <div className="relative">
                            <EntryDetailsPanel
                                details={details}
                                panelId={panelId}
                                open={detailsOpen}
                                title={film.title}
                                imdbID={film.imdbID}
                            />
                        </div>
                    )}
                </div>
            </article>
        </li>
    );
};

/**
 * The awards folded into this box, under the event they were given at.
 *
 * They keep their own icons and their own recipients but drop the film, because
 * the subject above already names it — repeating it on each line is exactly the
 * repetition the fold exists to remove.
 */
const FoldedTrophies: React.FC<{ trophies: TrophyEvent[] }> = ({ trophies }) => {
    if (trophies.length === 0) return null;

    return (
        <ul className="mt-2.5 space-y-2 border-t border-slate-600/25 pt-2.5">
            {trophies.map((event) => {
                const Icon = resolveTrophyIcon(event.trophy.award);
                return (
                    <li key={event.id} className="flex items-start gap-2">
                        <Icon
                            className="mt-1 h-4 w-4 flex-shrink-0 text-amber-400/70"
                            aria-hidden="true"
                        />
                        <div className="min-w-0 flex-grow">
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1.5 text-sm leading-relaxed text-slate-400">
                                {event.trophy.recipient ? (
                                    <>
                                        <MemberChip name={event.trophy.recipient} />
                                        <span>won the</span>
                                    </>
                                ) : (
                                    // A sheet award whose prose named nobody the
                                    // club recognizes. Rendered unattributed
                                    // rather than dropped, the same call the
                                    // trophy galleries make.
                                    <span>Awarded:</span>
                                )}
                                <span className="font-medium text-slate-200">
                                    {event.trophy.award}
                                </span>
                            </div>
                            {event.trophy.note && <Detail>{event.trophy.note}</Detail>}
                        </div>
                    </li>
                );
            })}
        </ul>
    );
};

/**
 * Who did it, and in what act — the meta band's half of the sentence.
 *
 * The sentence a row used to carry in one run is split at its verb: the actor
 * and the verb ride up here beside the date, and what they acted on stays below
 * in {@link WallSubject}. Two reasons, and the second is why it is worth doing
 * at every width rather than only on a phone.
 *
 * The first is width. A phone gives a row about 200px of column once the
 * timeline, the poster and two card paddings have taken theirs, and "Jacob
 * logged" spent a third of it saying the thing the node beside it was already
 * saying with his face. Moving the attribution to a band that runs the full
 * width of the card gives the title the column to itself.
 *
 * The second is that every row now opens on what it is *about*. That was
 * already the intent behind setting "The club watched" small and lettered — so
 * the film's own title read first rather than the third word of a sentence that
 * opens the same way every time — and this is that intent applied to all four
 * kinds instead of one.
 */
const WallActor: React.FC<{ event: WallEvent }> = ({ event }) => {
    switch (event.kind) {
        case 'club-watch':
            // No avatar: this is the one thing on the wall the club did rather
            // than one of its members, and leading with a face would file it
            // under whoever picked it.
            return (
                <span className="text-[10px] uppercase tracking-widest text-blue-300/70">
                    The club watched
                </span>
            );

        case 'log':
            return (
                <>
                    <MemberChip name={event.member} photo={false} />
                    <span>logged</span>
                </>
            );

        case 'list':
            return (
                <>
                    <MemberChip name={event.list.owner} />
                    <span>started a list</span>
                </>
            );

        case 'trophy':
            return event.trophy.recipient ? (
                <>
                    <MemberChip name={event.trophy.recipient} />
                    <span>won the</span>
                </>
            ) : (
                // A sheet award whose prose named nobody the club recognizes.
                // Rendered unattributed rather than dropped, the same call the
                // trophy galleries make.
                <span>Awarded:</span>
            );
    }
};

/** What they did it to: the row's subject, and the first thing on its line. */
const WallSubject: React.FC<{ event: WallEvent }> = ({ event }) => {
    switch (event.kind) {
        case 'club-watch':
            return (
                <>
                    <FilmTitle
                        imdbID={event.film.imdbID}
                        title={event.film.title}
                        year={event.film.year}
                        onSite
                        emphasis
                    />
                    {event.film.popcornPod && (
                        <span className="rounded-md bg-amber-400/[0.07] px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-400/70 ring-1 ring-inset ring-amber-400/20">
                            Popcorn Pod
                        </span>
                    )}
                </>
            );

        case 'log':
            return (
                <>
                    <FilmTitle
                        imdbID={event.entry.imdbID}
                        title={event.entry.title}
                        year={event.entry.year}
                        onSite={event.entry.clubFilm !== undefined}
                    />
                    {/* Marks the overlap explicitly, exactly as the watch log
                        does. Without it a club film in a personal log reads as a
                        club record, which is the one confusion to avoid. */}
                    {event.entry.clubFilm && (
                        <span className="rounded-md bg-amber-400/[0.07] px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-400/70 ring-1 ring-inset ring-amber-400/20">
                            Club film
                        </span>
                    )}
                </>
            );

        case 'list':
            return (
                <Link
                    to={`/lists/${event.list.id}`}
                    className="font-medium text-slate-200 decoration-slate-600 underline-offset-4 transition-colors hover:text-white hover:underline"
                >
                    {event.list.name}
                </Link>
            );

        case 'trophy':
            return (
                <>
                    <span className="font-medium text-slate-200">{event.trophy.award}</span>
                    <span className="text-slate-500">on</span>
                    <FilmTitle
                        imdbID={event.film.imdbID}
                        title={event.film.title}
                        year={null}
                        onSite
                    />
                </>
            );
    }
};

/** The line under the subject, when the event has anything more to say. */
const WallDetail: React.FC<{ event: WallEvent }> = ({ event }) => {
    switch (event.kind) {
        case 'club-watch':
            if (!event.selector) return null;
            return (
                // Not a Detail: this is a fact about the screening, not somebody
                // talking, so it takes no emerald rail.
                <p className="relative mt-1 text-sm text-slate-500">
                    <Link
                        to={`/profile/${encodeURIComponent(event.selector)}`}
                        className="text-slate-400 transition-colors hover:text-slate-200"
                    >
                        {event.selector}
                    </Link>
                    's pick
                </p>
            );

        case 'log':
            // Plain text rather than Markdown: the review renders as Markdown on
            // the member's log, and this is a plain-text reading of the same
            // words — expandable in place, so the whole review is here. Its line
            // breaks survive the trip; `Detail` says how.
            return event.entry.blurb ? <Detail>{event.entry.blurb}</Detail> : null;

        case 'list':
            return (
                <>
                    {/* Where the count used to sit. The count is a figure and has
                        gone up to the badge cluster with the other figures; what
                        the line under a subject is for is saying something about
                        it, and on a list that is what's on it. */}
                    <ListHead event={event} />
                    {/* Railed and expandable rather than run onto the line above:
                        a list's blurb is its owner talking, which is what the
                        rail means, and some of them run for a paragraph. */}
                    {event.list.description && <Detail>{event.list.description}</Detail>}
                </>
            );

        case 'trophy':
            return event.trophy.note ? <Detail>{event.trophy.note}</Detail> : null;
    }
};

/**
 * The number a row ends its subject line on: a score for a watch, a length for
 * a list.
 *
 * Inside the subject's own wrap container rather than in a column at the row's
 * edge: this way the badge follows the sentence when it wraps on a phone instead
 * of holding width the sentence needed, which is the arrangement the watch log
 * uses for its score and trailer. The `ml-auto` that pushes it there belongs to
 * the cluster it shares with the details expander, not to this badge.
 *
 * A list used to end this line on nothing, which is most of why it read as the
 * thin row among four — every other kind closes on a figure or a chip, and the
 * eye scanning down the wall found a hole where the beat was. Its count is a
 * figure and it belongs here, not buried in grey prose under the title.
 */
const WallFigure: React.FC<{ event: WallEvent }> = ({ event }) => {
    switch (event.kind) {
        case 'club-watch':
            return event.average === null ? null : (
                <span className="flex flex-shrink-0 items-baseline gap-1.5">
                    {/* Named on a wide screen, and on a phone left to the badge's
                        own tooltip — the label is twice the width of the number
                        it explains, and this row has none to spare down there. */}
                    <span className="hidden text-[10px] uppercase tracking-widest text-slate-600 sm:inline">
                        Club avg
                    </span>
                    <ScoreBadge
                        score={event.average}
                        title={`The club's average: ${event.average}/${MAX_SCORE}`}
                    />
                </span>
            );

        case 'log':
            return event.entry.score === null ? null : (
                <span className="flex flex-shrink-0 items-baseline gap-1.5">
                    {/* Named for the same reason the screening's average is, and
                        it is the more important of the two labels: this number
                        is one person's and counts toward nothing, and the club
                        average sitting in the identical badge two rows up is
                        exactly what it must not be read as. */}
                    <span className="hidden text-[10px] uppercase tracking-widest text-slate-600 sm:inline">
                        {event.member}'s
                    </span>
                    <ScoreBadge
                        score={event.entry.score}
                        qualifier={event.entry.scoreQualifier}
                        title={`${event.member}'s own rating: ${event.entry.score}/${MAX_SCORE}`}
                    />
                </span>
            );

        case 'list': {
            const count = event.list.entries.length;
            // The chip the wall already uses for "Club film" and "Popcorn Pod",
            // in the amber lists are drawn in — a label about the subject rather
            // than a number the club arrived at, which is the distinction the
            // mono score badge above carries and this one must not borrow.
            //
            // The glyph is the one place `ranked` shows on this wall: numerals
            // for a list making a claim about order, plain rules for one that is
            // merely arranged. No word for it — a chip that had to say "ranked"
            // as well as its count would be saying more than the row can spare.
            const Icon = isRankedList(event.list) ? NumberedListIcon : QueueListIcon;

            return (
                <span
                    className="flex flex-shrink-0 items-center gap-1.5 rounded-md bg-amber-400/[0.07] px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-400/70 ring-1 ring-inset ring-amber-400/20"
                    title={
                        isRankedList(event.list)
                            ? `A ranking of ${count} film${count !== 1 ? 's' : ''}`
                            : `A list of ${count} film${count !== 1 ? 's' : ''}`
                    }
                >
                    <Icon className="h-3 w-3" aria-hidden="true" />
                    {count} film{count !== 1 ? 's' : ''}
                </span>
            );
        }

        case 'trophy':
            return null;
    }
};

/**
 * The films at the head of a list, named.
 *
 * The deck of posters beside this is art rather than text: it says a list has
 * films on it without saying which, and a poster reduced to an 18px sliver of
 * itself isn't recognizable even to somebody who knows the film. So the row
 * says three of them out loud. Every other kind on this wall opens on the name
 * of the thing it is about, and a list was the one that didn't — it gave a
 * count and left the reader to open it to find out what kind of list it was.
 *
 * Three names and a remainder rather than a scrollable strip: this is a teaser
 * for a page one click away, and the point is to be read in passing.
 *
 * Plain text, not links. The names are here to characterize the list, and
 * three more link targets in a row that already has the list, its owner and its
 * deck would be four ways out of one box — see the note atop this file on the
 * box being a sibling-of-links structure rather than a thicket of them.
 */
const ListHead: React.FC<{ event: ListEvent }> = ({ event }) => {
    if (event.titles.length === 0) return null;

    // Counted off the list itself rather than off `titles`, so a film the
    // caches can't name yet is folded into the remainder instead of vanishing
    // from the row's arithmetic.
    const rest = event.list.entries.length - event.titles.length;

    return (
        <p className="relative mt-1 text-sm leading-relaxed text-slate-400">
            {event.titles.map((title, index) => (
                // Indexed as well as titled: a list may hold the same film twice
                // — a remake and its original share nothing but a name, and the
                // caches have been known to hand back one for the other.
                <React.Fragment key={`${title}-${index}`}>
                    {index > 0 && (
                        <span className="mx-1.5 text-slate-600" aria-hidden="true">
                            ·
                        </span>
                    )}
                    {title}
                </React.Fragment>
            ))}
            {rest > 0 && <span className="text-slate-600"> +{rest} more</span>}
        </p>
    );
};

/**
 * How many of the deck's cards a phone shows.
 *
 * Five was the whole reason the deck used to sit out every width below `sm`: at
 * 2.4rem a card with 1.15rem showing, five of them run to 112px, and a phone's
 * row hasn't got it to give. Three run to 75px, which it has — and a list row
 * with no art at all was the barest thing on this wall. The two cards past the
 * third are hidden rather than dropped, so the deck grows into the space at
 * `sm` instead of being rebuilt at it.
 */
const DECK_PHONE_COUNT = 3;

/**
 * A list's deck of posters, standing where every other row's poster stands —
 * on the far side, since a list is about several films and none of them is the
 * one the row is *of*.
 *
 * Overlapping in rank order, as the profile's list rows draw them. Later
 * siblings would paint over earlier ones, so the z-index descends to keep the
 * top-ranked poster on top of the stack.
 *
 * It fans open as the row is hovered — each card sliding out from behind the
 * one in front of it and tipping a degree or two further than its neighbour, so
 * a stack the reader can only half see resolves into a hand of them. The
 * geometry is in `index.css` under `.wall-deck-card`; what this sets is the one
 * number that drives it, which is how far back in the deck a card sits. It
 * opens to the *left*, into the gap between the deck and the title, because the
 * row is clipped to its own rounded corners and there is nothing to the right
 * but that clip. And the rings warm to amber with it: the row's border is
 * already doing that on hover, and the deck is the largest thing in the box
 * that wasn't joining in.
 */
const ListPosters: React.FC<{ event: WallEvent }> = ({ event }) => {
    if (event.kind !== 'list' || event.posters.length === 0) return null;

    return (
        <Link
            to={`/lists/${event.list.id}`}
            title={`Open ${event.list.name}`}
            tabIndex={-1}
            aria-hidden="true"
            className="col-start-3 row-start-1 ml-2 flex flex-shrink-0 transition-opacity duration-200 hover:opacity-80 sm:ml-3"
        >
            {event.posters.map((poster, index) => (
                <img
                    // Indexed as well as keyed by URL, for the reason ListHead
                    // gives: one list can hold two entries pointing at the same
                    // artwork, and two cards cannot share a key.
                    key={`${poster}-${index}`}
                    src={poster}
                    alt=""
                    loading="lazy"
                    style={
                        {
                            zIndex: event.posters.length - index,
                            '--deck-depth': event.posters.length - 1 - index,
                        } as React.CSSProperties
                    }
                    className={`wall-deck-card relative h-14 w-[2.4rem] rounded object-cover object-top shadow-sm shadow-black/40 ring-1 ring-slate-600/40 group-hover:ring-amber-400/30 ${
                        index === 0 ? '' : '-ml-5'
                    }${index < DECK_PHONE_COUNT ? '' : ' hidden sm:block'}`}
                    onError={(e) => {
                        e.currentTarget.style.display = 'none';
                    }}
                />
            ))}
        </Link>
    );
};

export default WallEventRow;
