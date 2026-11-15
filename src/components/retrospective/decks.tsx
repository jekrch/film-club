import type { Film } from '../../types/film';
import type { TeamMember } from '../../types/team';
import { COPPER } from '../../utils/chartTheme';
import { getFilmBackdrops } from '../../utils/filmUtils';
import { stillsFor } from '../../utils/retrospectiveArt';
import type { ClubRetrospective, MemberRetrospective } from '../../utils/retrospectiveUtils';
import type { StorySlide } from './Story';
import ClubCalendar from './slides/ClubCalendar';
import ClubClosing from './slides/ClubClosing';
import ClubCount from './slides/ClubCount';
import ClubFaces from './slides/ClubFaces';
import ClubFavourites from './slides/ClubFavourites';
import ClubOffDocket from './slides/ClubOffDocket';
import ClubPlaces from './slides/ClubPlaces';
import ClubReturning from './slides/ClubReturning';
import ClubSelections from './slides/ClubSelections';
import ClubTogether from './slides/ClubTogether';
import ClubTrophies from './slides/ClubTrophies';
import MemberBreakaway from './slides/MemberBreakaway';
import MemberClosing from './slides/MemberClosing';
import MemberCount from './slides/MemberCount';
import MemberFavourites from './slides/MemberFavourites';
import MemberLog from './slides/MemberLog';
import MemberPicks from './slides/MemberPicks';
import MemberScores from './slides/MemberScores';
import MemberShelf from './slides/MemberShelf';
import MemberTaste from './slides/MemberTaste';
import TitleCard from './slides/TitleCard';
import WordsSlide from './slides/WordsSlide';

/**
 * The two decks, slide by slide, in the plan's order. Each report field is one
 * slide, and a field with nothing to say (null) is simply not added — the deck
 * shrinks rather than showing a zero.
 *
 * A slide about a film carries that film's stills, which the deck plays behind
 * it; the title and closing slides lean on the year's wall of art instead.
 */

/** The art behind the title card and the closing slide; the rest keep it faint. */
const TITLE_ART = 0.6;
const CLOSING_ART = 0.32;

/** A club film's own stills, read off the record the report already holds. */
const filmStills = (film: Film): string[] =>
    getFilmBackdrops(film).filter((url) => url.startsWith('http'));

/** Stills of films known only by id (logged films, reviews), interleaved. */
const stillsOfIds = (ids: string[]): string[] =>
    stillsOfFilms(ids.map((id) => ({ stills: stillsFor(id) })));

/** Stills of several films, interleaved, so a slide about two films shows both. */
const stillsOfFilms = (films: (Film | { stills: string[] })[]): string[] => {
    const lists = films.map((f) => ('stills' in f ? f.stills : filmStills(f)));
    const out: string[] = [];
    for (let i = 0; i < Math.max(0, ...lists.map((l) => l.length)); i++) {
        lists.forEach((list) => list[i] && out.push(list[i]));
    }
    return out.slice(0, 12);
};

export const clubDeck = (report: ClubRetrospective, activeMembers: number): StorySlide[] => {
    const accent = COPPER;
    // Every film of the year, a frame or two each, for the reels.
    const yearReel = stillsOfFilms(report.films);
    const slides: StorySlide[] = [
        {
            id: 'title',
            reel: yearReel,
            artStrength: TITLE_ART,
            node: (
                <TitleCard
                    eyebrow="The Criterion Club"
                    title={String(report.year)}
                    subtitle={report.inProgress ? 'The year so far' : 'A retrospective'}
                    accent={accent}
                    reel={yearReel}
                />
            ),
        },
    ];
    const add = (slide: StorySlide | null | false) => slide && slides.push(slide);

    add(
        !!report.count && {
            id: 'count',
            reel: [...yearReel].reverse(),
            node: (
                <ClubCount
                    year={report.year}
                    inProgress={report.inProgress}
                    count={report.count}
                    activeMembers={activeMembers}
                    accent={accent}
                    reel={[...yearReel].reverse()}
                />
            ),
        }
    );
    add(
        !!report.calendar && {
            id: 'calendar',
            stills: stillsOfFilms([report.calendar.first, report.calendar.last]),
            node: (
                <ClubCalendar
                    calendar={report.calendar}
                    films={report.films}
                    inProgress={report.inProgress}
                    accent={accent}
                />
            ),
        }
    );
    add(
        !!report.places && {
            id: 'places',
            stills: stillsOfFilms([report.places.oldest, report.places.newest]),
            node: <ClubPlaces year={report.year} places={report.places} accent={accent} />,
        }
    );
    add(
        !!report.together && {
            id: 'together',
            stills: filmStills(report.together.loved.film),
            node: (
                <ClubTogether
                    together={report.together}
                    lovedStills={filmStills(report.together.loved.film).slice(1)}
                    accent={accent}
                />
            ),
        }
    );
    add(
        !!report.favourites && {
            id: 'favourites',
            node: (
                <ClubFavourites
                    favourites={report.favourites}
                    stillsOf={filmStills}
                    accent={accent}
                />
            ),
        }
    );
    add(
        !!report.selections && {
            id: 'picks',
            reel: stillsOfFilms(report.selections.flatMap((s) => s.films)),
            stills: stillsOfFilms(report.selections.flatMap((s) => s.films)),
            node: (
                <ClubSelections
                    selections={report.selections}
                    accent={accent}
                    reel={stillsOfFilms(report.selections.flatMap((s) => s.films))}
                />
            ),
        }
    );
    if (report.faces) {
        const films = report.faces.flatMap((f) => f.credits.map((c) => c.film));
        slides.push({
            id: 'faces',
            reel: stillsOfFilms(films),
            stills: stillsOfFilms(films),
            node: <ClubFaces faces={report.faces} reel={stillsOfFilms(films)} accent={accent} />,
        });
    }
    if (report.returning) {
        const now = report.returning.flatMap((r) => r.now.map((c) => c.film));
        const before = report.returning.flatMap((r) => r.before.map((c) => c.film));
        slides.push({
            id: 'returning',
            reel: stillsOfFilms([...before, ...now]),
            stills: stillsOfFilms(now),
            node: (
                <ClubReturning
                    year={report.year}
                    returning={report.returning}
                    reel={stillsOfFilms([...before, ...now])}
                    accent={accent}
                />
            ),
        });
    }
    add(
        !!report.trophies && {
            id: 'trophies',
            node: <ClubTrophies trophies={report.trophies} accent={accent} />,
        }
    );
    add(
        !!report.offDocket && {
            id: 'off-docket',
            stills: report.offDocket.sharedFilms.length
                ? stillsFor(report.offDocket.sharedFilms[0].imdbID)
                : undefined,
            node: (
                <ClubOffDocket
                    offDocket={report.offDocket}
                    sharedStills={
                        report.offDocket.sharedFilms.length
                            ? stillsFor(report.offDocket.sharedFilms[0].imdbID).slice(1)
                            : []
                    }
                    accent={accent}
                />
            ),
        }
    );
    if (report.words) {
        const clips = report.words.highlights;
        slides.push({
            id: 'words',
            stills: stillsOfIds(clips.map((c) => c.imdbID)),
            node: (
                <WordsSlide
                    count={report.words.count}
                    detail={`${report.words.club} for the club, ${report.words.log} in our own logs`}
                    clips={clips}
                    stillsOf={stillsFor}
                    who="we"
                    moreTo="/log"
                    accent={accent}
                />
            ),
        });
    }
    slides.push({
        id: 'closing',
        reel: yearReel,
        artStrength: CLOSING_ART,
        node: (
            <ClubClosing
                year={report.year}
                roster={report.roster}
                guests={report.guests}
                accent={accent}
                reel={yearReel}
            />
        ),
    });
    return slides;
};

export const memberDeck = (
    report: MemberRetrospective,
    others: TeamMember[],
    accent: string
): StorySlide[] => {
    // Everything they saw this year, club and log, a frame or two each.
    const yearReel = stillsOfFilms([...report.films.club, ...report.films.log]);
    const slides: StorySlide[] = [
        {
            id: 'title',
            reel: yearReel,
            artStrength: TITLE_ART,
            node: (
                <TitleCard
                    eyebrow={`The Criterion Club · ${report.year}`}
                    title={`${report.member.name}'s year`}
                    subtitle={report.member.title}
                    accent={accent}
                    reel={yearReel}
                    avatar={{ src: report.member.image, name: report.member.name }}
                />
            ),
        },
        {
            id: 'count',
            reel: [...yearReel].reverse(),
            node: (
                <MemberCount
                    year={report.year}
                    inProgress={report.inProgress}
                    count={report.count}
                    accent={accent}
                    reel={[...yearReel].reverse()}
                />
            ),
        },
    ];
    const add = (slide: StorySlide | null | false) => slide && slides.push(slide);

    if (report.scores) {
        const favourite = report.scores.highest.film;
        slides.push({
            id: 'favourites',
            stills: filmStills(favourite),
            node: (
                <MemberFavourites
                    scores={report.scores}
                    stills={filmStills(favourite).slice(1)}
                    accent={accent}
                />
            ),
        });
        slides.push({
            id: 'scores',
            node: <MemberScores scores={report.scores} accent={accent} />,
        });
    }
    add(
        !!report.picks && {
            id: 'picks',
            stills: stillsOfFilms(report.picks),
            node: <MemberPicks picks={report.picks} stillsOf={filmStills} accent={accent} />,
        }
    );
    add(
        !!report.breakaway && {
            id: 'breakaway',
            stills: filmStills(report.breakaway.film),
            node: <MemberBreakaway breakaway={report.breakaway} accent={accent} />,
        }
    );
    add(
        !!report.log && {
            id: 'log',
            reel: stillsOfFilms(report.films.log),
            stills: stillsOfFilms([report.log.first, report.log.last]),
            node: (
                <MemberLog
                    log={report.log}
                    onOwn={report.count.onOwn}
                    accent={accent}
                    reel={stillsOfFilms(report.films.log)}
                />
            ),
        }
    );
    add(
        !!report.taste && {
            id: 'taste',
            node: <MemberTaste taste={report.taste} director={report.director} accent={accent} />,
        }
    );
    if (report.words) {
        const clips = report.words.highlights;
        slides.push({
            id: 'words',
            stills: stillsOfIds(clips.map((c) => c.imdbID)),
            node: (
                <WordsSlide
                    count={report.words.count}
                    clips={clips}
                    stillsOf={stillsFor}
                    who="you"
                    moreTo={`/watched/${report.member.name}`}
                    accent={accent}
                />
            ),
        });
    }
    add(
        (!!report.trophies || !!report.lists) && {
            id: 'shelf',
            node: <MemberShelf trophies={report.trophies} lists={report.lists} accent={accent} />,
        }
    );
    slides.push({
        id: 'closing',
        reel: yearReel,
        artStrength: CLOSING_ART,
        node: (
            <MemberClosing
                year={report.year}
                member={report.member}
                closing={report.closing}
                others={others}
                accent={accent}
                reel={yearReel}
            />
        ),
    });
    return slides;
};
