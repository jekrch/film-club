import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid';
import { EyeIcon, FilmIcon, QueueListIcon } from '@heroicons/react/24/outline';

import CircularImage from '../common/CircularImage';
import CollapsibleContent from '../common/CollapsableContent';
import RowFrameWash from '../common/RowFrameWash';
import { resolveTrophyIcon, type IconComponent } from '../common/trophyIcons';
import { getRatingColorClass } from '../../utils/ratingUtils';
import { MAX_SCORE } from '../../utils/ratingEditUtils';
import { formatWatchDate, watchedRowId } from '../../utils/watchedUtils';
import type { CardAccent } from '../common/accents';
import type { TrophyEvent, WallEvent, WallRow } from '../../utils/wallUtils';
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
 * Every kind wears the same box — a node on the timeline, a dated caption, a
 * sentence naming who did what, and the subject's art washed in from the right.
 * What changes between them is the sentence and the badge at the end of it, and
 * that is on purpose: the wall's job is to be read straight down, and four
 * layouts interleaved would make the reader re-learn where to look on every row.
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
    const position = 'absolute left-0 top-2 h-8 w-8 sm:h-9 sm:w-9';

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
 * Secondary prose under the headline — a review, a note, a list's blurb.
 *
 * Railed rather than merely greyed: the line under a headline is the one place
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
    /** A list has no single poster, so its column-one slot is not drawn at all. */
    const hasPoster = lead.kind !== 'list';
    /** The club's own screening, which the wall draws with more weight than the rest. */
    const clubPick = lead.kind === 'club-watch';

    return (
        <li className="relative pl-11 sm:pl-14">
            {/* The rail runs from under this node to the next one rather than
                behind them all, so a node needs no fill of its own to punch
                through it — which matters on a page whose background is a
                gradient and has no single shade to paint with. */}
            {connected && (
                <span
                    className="absolute bottom-0 left-4 top-10 w-px bg-slate-700/50 sm:left-[1.125rem] sm:top-11"
                    aria-hidden="true"
                />
            )}
            <TimelineNode event={lead} accent={accent} />

            <article
                className={`group relative overflow-hidden rounded-xl border p-3 transition-colors duration-200 sm:p-4 ${
                    clubPick
                        ? CLUB_PICK_ROW_CLASS
                        : `border-slate-600/30 bg-slate-700/25 hover:bg-slate-700/45 ${ROW_HOVER_CLASS[accent]}`
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
                    headline's column, and on a phone that column is barely
                    150px once the timeline and the poster have taken theirs,
                    which turns a review into a ribbon of three-word lines.
                    Spanning the full width down there is a change of placement,
                    not of markup — which a flex row would need two copies of. */}
                <div className="relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-start">
                    {hasPoster && (
                        <Link
                            to={eventHome(lead)}
                            title={`Open ${eventHomeLabel(lead)}`}
                            className="col-start-1 row-start-1 block rounded-md transition-opacity duration-200 hover:opacity-80 sm:row-span-2"
                        >
                            <EventPoster
                                src={lead.kind === 'log' ? lead.entry.poster : lead.film.poster}
                                title={
                                    lead.kind === 'log'
                                        ? (lead.entry.title ?? 'Unknown film')
                                        : lead.film.title
                                }
                            />
                        </Link>
                    )}

                    <div
                        className={`col-start-2 row-start-1 min-w-0${hasPoster ? ' ml-3 sm:ml-4' : ''}`}
                    >
                        {/* The wall is ordered by when, so the date leads the row
                            — as a caption over the sentence rather than a column
                            beside it, which is where the watch log settled for
                            the same reason: every row's date at the same place
                            under the same edge is what makes dates scannable. */}
                        <time
                            dateTime={lead.date}
                            className={`block text-xs uppercase tracking-widest tabular-nums text-slate-500 transition-colors duration-200 ${DATE_HOVER_CLASS[accent]}`}
                        >
                            {formatWatchDate(lead.date)}
                        </time>

                        {/* The score travels at the end of the sentence rather
                            than in a column of its own at the row's edge — the
                            watch log's arrangement, and the one that leaves the
                            sentence its full width on a phone instead of
                            squeezing it between a poster and a badge. */}
                        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1.5 leading-relaxed text-slate-400">
                            <WallHeadline event={lead} />
                            <WallScore event={lead} />
                        </div>
                    </div>

                    <ListPosters event={lead} />

                    {/* Full width beneath everything on a phone, back in the
                        headline's column from `sm` up. */}
                    <div
                        className={`col-span-3 col-start-1 row-start-2 min-w-0 sm:col-span-1 sm:col-start-2${
                            hasPoster ? ' sm:ml-4' : ''
                        }`}
                    >
                        <WallDetail event={lead} />
                        <FoldedTrophies trophies={trophies} />
                    </div>
                </div>
            </article>
        </li>
    );
};

/**
 * The awards folded into this box, under the event they were given at.
 *
 * They keep their own icons and their own recipients but drop the film, because
 * the headline above already names it — repeating it on each line is exactly the
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

/** Who did what. One sentence per kind, all in the same voice. */
const WallHeadline: React.FC<{ event: WallEvent }> = ({ event }) => {
    switch (event.kind) {
        case 'club-watch':
            // No avatar: this is the one thing on the wall the club did rather
            // than one of its members, and leading with a face would file it
            // under whoever picked it.
            return (
                <>
                    {/* Set small and lettered, so the film's own title is the
                        first thing read on the row rather than the third word of
                        a sentence that opens the same way every time. */}
                    <span className="text-[10px] uppercase tracking-widest text-blue-300/70">
                        The club watched
                    </span>
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
                    <MemberChip name={event.member} photo={false} />
                    <span>logged</span>
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
                <>
                    <MemberChip name={event.list.owner} />
                    <span>started a list</span>
                    <Link
                        to={`/lists/${event.list.id}`}
                        className="font-medium text-slate-200 decoration-slate-600 underline-offset-4 transition-colors hover:text-white hover:underline"
                    >
                        {event.list.name}
                    </Link>
                </>
            );

        case 'trophy':
            return (
                <>
                    {event.trophy.recipient ? (
                        <>
                            <MemberChip name={event.trophy.recipient} />
                            <span>won the</span>
                        </>
                    ) : (
                        // A sheet award whose prose named nobody the club
                        // recognizes. Rendered unattributed rather than dropped,
                        // the same call the trophy galleries make.
                        <span>Awarded:</span>
                    )}
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

/** The line under the headline, when the event has anything more to say. */
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
                    <p className="relative mt-1 text-sm text-slate-500">
                        {event.list.entries.length} film
                        {event.list.entries.length !== 1 ? 's' : ''}
                    </p>
                    {/* Railed and expandable rather than run onto the count line:
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
 * The score at the end of the headline, when the event carries one.
 *
 * `ml-auto` inside the headline's own wrap container rather than a column at the
 * row's edge: this way the badge follows the sentence when it wraps on a phone
 * instead of holding width the sentence needed, which is the arrangement the
 * watch log uses for its score and trailer.
 */
const WallScore: React.FC<{ event: WallEvent }> = ({ event }) => {
    switch (event.kind) {
        case 'club-watch':
            return event.average === null ? null : (
                <span className="ml-auto flex flex-shrink-0 items-baseline gap-1.5">
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
                <span className="ml-auto flex flex-shrink-0 items-baseline gap-1.5">
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

        case 'list':
        case 'trophy':
            return null;
    }
};

/**
 * A list's stacked preview, standing where every other row's poster stands —
 * on the far side, since a stack five posters wide is the one piece of art here
 * that will not fit a phone's column. Below `sm` the row goes without it.
 *
 * Overlapping in rank order, as the profile's list rows draw them. Later
 * siblings would paint over earlier ones, so the z-index descends to keep the
 * top-ranked poster on top of the stack.
 */
const ListPosters: React.FC<{ event: WallEvent }> = ({ event }) => {
    if (event.kind !== 'list' || event.posters.length === 0) return null;

    return (
        <Link
            to={`/lists/${event.list.id}`}
            title={`Open ${event.list.name}`}
            tabIndex={-1}
            aria-hidden="true"
            className="col-start-3 row-start-1 ml-3 hidden flex-shrink-0 transition-opacity duration-200 hover:opacity-80 sm:flex"
        >
            {event.posters.map((poster, index) => (
                <img
                    key={poster}
                    src={poster}
                    alt=""
                    loading="lazy"
                    style={{ zIndex: event.posters.length - index }}
                    className={`relative h-14 w-[2.4rem] rounded object-cover object-top shadow-sm shadow-black/40 ring-1 ring-slate-600/40 ${index === 0 ? '' : '-ml-5'}`}
                    onError={(e) => {
                        e.currentTarget.style.display = 'none';
                    }}
                />
            ))}
        </Link>
    );
};

export default WallEventRow;
