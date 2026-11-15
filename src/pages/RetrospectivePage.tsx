import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { PlayIcon } from '@heroicons/react/24/solid';
import { SOUNDTRACKS, playOrder, soundtrackChoices } from '../config/retrospective';
import { useResponses } from '../contexts/ResponsesContext';
import { useTrophies } from '../contexts/TrophiesContext';
import { useSoundtrack } from '../hooks/useSoundtrack';
import { ALL_MEMBERS, useWatchedLog } from '../hooks/useWatchedLog';
import { filmData } from '../types/film';
import { filmLists, listFilmSummaries } from '../types/list';
import { teamMembers, type TeamMember } from '../types/team';
import { COPPER } from '../utils/chartTheme';
import { FADE_OUT_MS } from '../utils/youtubePlayer';
import { yearArt } from '../utils/retrospectiveArt';
import {
    buildClubRetrospective,
    buildMemberRetrospective,
    yearsWithData,
    type RetrospectiveSources,
} from '../utils/retrospectiveUtils';
import CircularImage from '../components/common/CircularImage';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Mosaic from '../components/retrospective/Mosaic';
import { Eyebrow } from '../components/retrospective/Slide';
import SoundtrackDock from '../components/retrospective/SoundtrackDock';
import Story from '../components/retrospective/Story';
import { clubDeck, memberDeck } from '../components/retrospective/decks';
import { memberColor, retrospectivePath } from '../components/retrospective/slides/format';
import { MemberFace } from '../components/retrospective/slides/shared';

const ACTIVE = teamMembers.filter((m) => typeof m.queue === 'number' && m.queue > 0);

/** Where the reader's choice of music is remembered, in this browser only. */
const CHOICE_KEY = 'retrospective-soundtrack';
const SILENCE = 'none';
/** The address's name for the chosen music. */
const MUSIC_PARAM = 'music';

const rememberedChoice = (): string | null => {
    try {
        return window.localStorage.getItem(CHOICE_KEY);
    } catch {
        return null;
    }
};

const rememberChoice = (id: string): void => {
    try {
        window.localStorage.setItem(CHOICE_KEY, id);
    } catch {
        // Private windows and blocked storage: the choice just isn't kept.
    }
};

const accentOf = (member: TeamMember | undefined): string =>
    member ? memberColor(member, Math.max(0, teamMembers.indexOf(member))) : COPPER;

/**
 * The way into each member's own report from the cover, their faces in a row:
 * on the club's cover, everyone with a year; on a member's, the club and
 * everyone else.
 */
const ReportPicker: React.FC<{
    year: number;
    members: TeamMember[];
    /** The member whose cover this is; they're left out, and the club put in. */
    current?: TeamMember;
}> = ({ year, members, current }) => {
    const others = members.filter((m) => m !== current);
    if (!others.length && !current) return null;
    return (
        <nav className="mt-12" aria-label="Other retrospectives">
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                {current ? 'Everyone else' : 'Or start with one of us'}
            </p>
            <ul className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-4 sm:gap-x-8">
                {current && (
                    <li>
                        <Link
                            to={retrospectivePath(year)}
                            className="group flex flex-col items-center gap-2"
                        >
                            <span
                                className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-950/70 font-serif text-lg text-slate-100 transition-transform group-hover:scale-105 sm:h-[4.5rem] sm:w-[4.5rem] sm:text-xl"
                                style={{ boxShadow: `0 0 0 2px ${COPPER}` }}
                            >
                                {year}
                            </span>
                            <span className="text-sm font-medium" style={{ color: COPPER }}>
                                The club
                            </span>
                        </Link>
                    </li>
                )}
                {others.map((member) => (
                    <li key={member.name}>
                        <Link
                            to={retrospectivePath(year, member.name)}
                            className="group flex flex-col items-center gap-2"
                        >
                            <MemberFace
                                name={member.name}
                                color={accentOf(member)}
                                size="w-14 h-14 sm:w-[4.5rem] sm:h-[4.5rem]"
                                className="transition-transform group-hover:scale-105"
                            />
                            <span
                                className="text-sm font-medium"
                                style={{ color: accentOf(member) }}
                            >
                                {member.name}
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </nav>
    );
};

/** For a year or member with nothing in it: somewhere to go rather than nowhere. */
const NothingToShow: React.FC<{ year: string; years: number[]; memberName?: string }> = ({
    year,
    years,
    memberName,
}) => (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <Eyebrow>Retrospective</Eyebrow>
        <h1 className="mt-3 font-serif text-3xl text-slate-100">
            Nothing to show for {memberName ? `${memberName} in ` : ''}
            {year}
        </h1>
        {years.length > 0 && (
            <p className="mt-6 text-slate-400">
                Try{' '}
                {years.map((y, i) => (
                    <React.Fragment key={y}>
                        {i > 0 && ' · '}
                        <Link
                            to={retrospectivePath(y)}
                            className="text-slate-200 underline-offset-4 hover:underline"
                        >
                            {y}
                        </Link>
                    </React.Fragment>
                ))}
            </p>
        )}
    </div>
);

/**
 * `/retrospective/:year` and `/retrospective/:year/:memberName`: the club's year
 * or one member's, as a deck of slides with music behind it.
 *
 * Before the play control is pressed this is an ordinary page — the cover, the
 * navbar above it, and a choice of music. Pressing play is the gesture that
 * lets the music start; it opens the deck over the page.
 *
 * The current slide is in the address as `?slide=n` (the route itself already
 * lives in the hash), pushed on every move, so the back button steps back a
 * slide and a link can point at one. A link with a slide in it opens the deck
 * straight on that slide; with no tap behind it the browser may hold the music
 * back, and the bar then asks for a tap on the video. The chosen music is in
 * the address too, as `?music=<id>`.
 */
const RetrospectivePage: React.FC = () => {
    const { year: yearParam = '', memberName } = useParams();
    const year = /^\d{4}$/.test(yearParam) ? Number(yearParam) : NaN;
    const [params, setParams] = useSearchParams();

    const { films: trophies } = useTrophies();
    const { threads } = useResponses();
    const { log, failed } = useWatchedLog(ALL_MEMBERS);
    const logsReady = log !== null || failed;

    const sources = useMemo<RetrospectiveSources>(
        () => ({
            films: filmData,
            watched: log ?? {},
            summaries: listFilmSummaries,
            trophies,
            responses: { threads },
            lists: filmLists,
            members: teamMembers,
        }),
        [log, trophies, threads]
    );

    const club = useMemo(
        () => (Number.isNaN(year) || memberName ? null : buildClubRetrospective(year, sources)),
        [year, memberName, sources]
    );
    const mine = useMemo(
        () =>
            Number.isNaN(year) || !memberName
                ? null
                : buildMemberRetrospective(year, memberName, sources),
        [year, memberName, sources]
    );

    const member = mine?.member;
    const accent = accentOf(member);
    const art = useMemo(
        () => (club ? yearArt(club.films) : mine ? yearArt(mine.films.club, mine.films.log) : []),
        [club, mine]
    );
    // The active members with a report of their own this year.
    const withReports = useMemo(
        () =>
            Number.isNaN(year)
                ? []
                : ACTIVE.filter(
                      (m) => m === mine?.member || buildMemberRetrospective(year, m.name, sources)
                  ),
        [year, mine, sources]
    );
    const slides = useMemo(() => {
        if (club) return clubDeck(club, ACTIVE.length);
        if (mine) {
            const others = withReports.filter((m) => m !== mine.member);
            return memberDeck(mine, others, accentOf(mine.member));
        }
        return [];
    }, [club, mine, withReports]);
    // Whose deck this is, in the corner of every slide.
    const faces = useMemo(
        () =>
            (mine ? [mine.member] : (club?.roster ?? [])).map((m) => ({
                name: m.name,
                color: accentOf(m),
            })),
        [club, mine]
    );

    // The music: chosen on the cover, or none, and kept in the address as
    // `?music=<id>` so a link carries it. Without one there, an audition is
    // preselected; otherwise the last choice in this browser; otherwise the
    // first. The rest are queued after it, for the player's own skip buttons.
    const audition = params.get('track');
    const choices = useMemo(() => soundtrackChoices(audition), [audition]);
    const isChoice = useCallback(
        (id: string | null): id is string => id === SILENCE || choices.some((c) => c.id === id),
        [choices]
    );
    const fallbackId = (): string => {
        if (choices !== SOUNDTRACKS) return choices[0].id;
        const remembered = rememberedChoice();
        return isChoice(remembered) ? remembered : choices[0].id;
    };
    const musicParam = params.get(MUSIC_PARAM);
    const choiceId = isChoice(musicParam) ? musicParam : fallbackId();
    const setMusicParam = useCallback(
        (id: string) =>
            setParams(
                (prev) => {
                    const updated = new URLSearchParams(prev);
                    updated.set(MUSIC_PARAM, id);
                    return updated;
                },
                { replace: true }
            ),
        [setParams]
    );
    // An address without a choice (or with one that isn't) gets the one in use.
    useEffect(() => {
        if (musicParam !== choiceId) setMusicParam(choiceId);
    }, [musicParam, choiceId, setMusicParam]);
    const choose = (id: string) => {
        setMusicParam(id);
        rememberChoice(id);
    };
    const queue = useMemo(() => playOrder(choices, choiceId), [choices, choiceId]);
    const hasMusic = queue.length > 0;

    const soundtrack = useSoundtrack();
    const { start: startMusic, stop: stopMusic, reset: resetMusic } = soundtrack;
    // A different choice is a different player; the old one's state goes with it.
    useEffect(() => resetMusic(), [choiceId, resetMusic]);
    const nowPlaying = queue[soundtrack.playlistIndex] ?? queue[0];

    // A link to a slide opens the deck on it, without the cover. There's been
    // no tap to let the music start, so it is tried anyway once the deck is up
    // and, if the browser refuses, the bar asks for a tap on the video.
    const [started, setStarted] = useState(() => params.get('slide') !== null);
    const autoStart = useRef(started);
    // The player exists only during the show, plus long enough after it to
    // fade out. Each play gets a fresh one, so nothing from the last carries.
    const [session, setSession] = useState(0);
    const [lingering, setLingering] = useState(false);
    const linger = useCallback(() => {
        setLingering(true);
        window.setTimeout(() => setLingering(false), FADE_OUT_MS + 200);
    }, []);
    const slideParam = params.get('slide');
    // Held until the logs are in, so a linked slide is counted in the full deck.
    const playing = started && slideParam !== null && slides.length > 0 && logsReady;
    const index = Math.min(Math.max((Number(slideParam) || 1) - 1, 0), slides.length - 1);

    const setSlide = useCallback(
        (next: number) =>
            setParams((prev) => {
                const updated = new URLSearchParams(prev);
                updated.set('slide', String(next + 1));
                return updated;
            }),
        [setParams]
    );

    useEffect(() => {
        if (!playing || !autoStart.current) return;
        autoStart.current = false;
        if (hasMusic) startMusic();
    }, [playing, hasMusic, startMusic]);

    const play = () => {
        autoStart.current = false;
        setStarted(true);
        if (hasMusic) {
            // Sent now, inside the tap, and held until the new player is
            // listening; the tap is what lets it start with sound.
            resetMusic();
            setSession((n) => n + 1);
            startMusic();
        }
        if (slideParam === null) setSlide(0);
    };

    const close = useCallback(() => {
        autoStart.current = false;
        stopMusic();
        linger();
        setStarted(false);
        setParams(
            (prev) => {
                const updated = new URLSearchParams(prev);
                updated.delete('slide');
                return updated;
            },
            { replace: true }
        );
    }, [stopMusic, linger, setParams]);

    // Back past the first slide takes the slide out of the address: that's a
    // close, made with the browser's button rather than ours.
    useEffect(() => {
        if (started && slideParam === null) {
            stopMusic();
            linger();
            setStarted(false);
        }
    }, [started, slideParam, stopMusic, linger]);

    // The page behind the deck doesn't scroll while the deck is up.
    useEffect(() => {
        if (!playing) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previous;
        };
    }, [playing]);

    // A member's report may be nothing but log entries, which arrive after the
    // first render; wait for them before saying there's nothing.
    if (memberName && !mine && !logsReady) return <LoadingSpinner />;

    const hasClubYear = !!club && (club.films.length > 0 || club.offDocket !== null);
    if (!mine && !hasClubYear) {
        return (
            <NothingToShow
                year={yearParam}
                years={yearsWithData(sources)}
                memberName={memberName}
            />
        );
    }

    const title = mine ? `${mine.member.name}'s ${year}` : String(year);

    return (
        <>
            <section className="relative isolate flex min-h-[calc(100svh-5rem)] items-center overflow-hidden px-4 py-16">
                <Mosaic images={art} strength={0.45} />
                <div className="relative mx-auto w-full max-w-2xl text-center">
                    {mine && (
                        <div
                            className="mx-auto mb-6 w-fit rounded-full p-1"
                            style={{ boxShadow: `0 0 0 2px ${accent}` }}
                        >
                            <CircularImage
                                src={mine.member.image}
                                alt={mine.member.name}
                                size="w-24 h-24 sm:w-32 sm:h-32"
                            />
                        </div>
                    )}
                    <Eyebrow color={accent}>The Criterion Club · Retrospective</Eyebrow>
                    <h1 className="mt-4 font-serif text-5xl leading-none text-slate-50 sm:text-7xl">
                        {title}
                    </h1>
                    <p className="mt-5 font-serif text-lg italic text-slate-300 sm:text-xl">
                        A year in review
                    </p>
                    <button
                        type="button"
                        onClick={play}
                        disabled={!logsReady}
                        className="mt-10 inline-flex items-center gap-3 rounded-full px-7 py-3 font-sans text-base font-semibold text-page shadow-lg transition-transform hover:scale-[1.03] disabled:cursor-wait disabled:opacity-60"
                        style={{ backgroundColor: accent }}
                    >
                        <PlayIcon className="h-5 w-5" />
                        {logsReady ? 'Play' : 'Setting up the projector…'}
                    </button>
                    <fieldset className="mt-8">
                        <legend className="mx-auto mb-3 font-sans text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            Choose the score
                        </legend>
                        <div className="flex flex-wrap justify-center gap-2">
                            {[...choices, { id: SILENCE, label: 'No music' }].map((choice) => {
                                const selected = choice.id === (hasMusic ? choiceId : SILENCE);
                                return (
                                    <button
                                        key={choice.id}
                                        type="button"
                                        onClick={() => choose(choice.id)}
                                        aria-pressed={selected}
                                        className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                                            selected
                                                ? 'bg-slate-100/10 text-slate-50'
                                                : 'text-slate-400 ring-1 ring-slate-100/15 hover:text-slate-200'
                                        }`}
                                        style={
                                            selected
                                                ? { boxShadow: `inset 0 0 0 1px ${accent}` }
                                                : undefined
                                        }
                                    >
                                        {choice.label}
                                    </button>
                                );
                            })}
                        </div>
                    </fieldset>
                    <ReportPicker year={year} members={withReports} current={mine?.member} />
                </div>
            </section>

            {playing && (
                <Story
                    slides={slides}
                    art={art}
                    index={index}
                    onIndexChange={setSlide}
                    onClose={close}
                    accent={accent}
                    faces={faces}
                    music={
                        nowPlaying
                            ? {
                                  label: nowPlaying.label,
                                  muted: soundtrack.muted,
                                  onToggleMute: () => soundtrack.setMuted(!soundtrack.muted),
                                  blocked: soundtrack.status === 'blocked',
                              }
                            : undefined
                    }
                />
            )}

            {hasMusic && (playing || lingering) && (
                <SoundtrackDock
                    key={session}
                    queue={queue}
                    soundtrack={soundtrack}
                    leaving={!playing}
                />
            )}
        </>
    );
};

export default RetrospectivePage;
