import { Film, filmData } from '../types/film';
import { listFilmSummaries, type ListFilmSummary } from '../types/list';
import type { TeamMember } from '../types/team';
import {
    entryFrameSource,
    filmFrameSource,
    toFrameSources,
    type FrameSource,
} from './frameSources';
import { pendingFilmSummary } from './pendingFilmSummaries';

/**
 * What a profile banner draws, once the member has had their say.
 *
 * The banner used to be a fixed rule — the six club films this member scored
 * highest — which is a good default and a poor only option: it says what someone
 * rated well, not what they would put on a wall. A member may now name the films
 * instead, and those need not be club films. That is the whole reason this
 * module resolves art the way the list and watch-log rows do, through
 * {@link FrameSource}, rather than through `Film`: a member's favorite is far
 * more likely to be in the summary cache than in `films.json`.
 */

/**
 * Films one member may name. Matches `LIMITS.backdropFilms` in the worker, and
 * both match the three panels `HeroCollageBackground` has to fill — a fourth
 * would be stored, validated, and never drawn.
 */
export const BACKDROP_FILM_LIMIT = 3;

/** Bundled data, overridable so tests can supply fixtures instead of mocking modules. */
export interface BackdropDataSources {
    films?: Film[];
    summaries?: Record<string, ListFilmSummary>;
}

/**
 * One named film, resolved for both the banner and the editor that picked it.
 *
 * The two want different halves of the same lookup — the banner wants art, the
 * editor wants a title and a poster to draw a chip with — and doing it once
 * keeps them agreeing about what an id refers to.
 */
export interface ResolvedBackdropFilm {
    imdbID: string;
    /** Null when nothing on this site has heard of the id yet. */
    title: string | null;
    year: string | null;
    poster: string | null;
    /** True when the film has a page here, which is where a chip should link. */
    onSite: boolean;
    /** Art for the banner. `images` is empty when CI hasn't enriched the id yet. */
    frame: FrameSource;
}

/** Lazy index of the bundled club films, so resolving three ids isn't three scans. */
let bundledFilmIndex: Map<string, Film> | null = null;

const indexFilms = (films: Film[]): Map<string, Film> => {
    if (films === filmData) {
        bundledFilmIndex ??= new Map(filmData.map((film) => [film.imdbID, film]));
        return bundledFilmIndex;
    }
    return new Map(films.map((film) => [film.imdbID, film]));
};

/**
 * Fills in one named id: the club record if there is one, then the summary
 * cache, then whatever the search hit that picked it knew, and finally a
 * title-less placeholder.
 *
 * The same ladder `resolveWatchedEntry` climbs, and for the same reason — a film
 * named a minute ago has not been through the CI step that fetches its artwork,
 * and that should cost the banner one panel rather than the page.
 */
export const resolveBackdropFilm = (
    imdbID: string,
    sources: BackdropDataSources = {}
): ResolvedBackdropFilm => {
    const clubFilm = indexFilms(sources.films ?? filmData).get(imdbID);
    if (clubFilm) {
        return {
            imdbID,
            title: clubFilm.title,
            year: clubFilm.year ?? null,
            poster: clubFilm.poster ?? null,
            onSite: true,
            frame: filmFrameSource(clubFilm),
        };
    }

    const summary = (sources.summaries ?? listFilmSummaries)[imdbID] ?? pendingFilmSummary(imdbID);
    const title = summary?.title ?? null;
    const poster = summary?.poster ?? null;

    return {
        imdbID,
        title,
        year: summary?.year ?? null,
        poster,
        onSite: false,
        frame: entryFrameSource({
            imdbID,
            title,
            poster,
            backdropImages: summary?.backdropImages,
        }),
    };
};

/**
 * The art a profile banner should draw for this member.
 *
 * Falls back to the top-rated collage when a selection resolves to nothing at
 * all — every named film is still waiting on CI, or none of them has artwork
 * anywhere. That is a narrow case and a temporary one, and the alternative is a
 * banner that renders as an empty card for the minute after a member picks their
 * films. A selection that resolves *partly* is used as-is: two panels of what
 * they asked for beats two of theirs and one of ours.
 */
export const profileBackdropSources = (
    member: Pick<TeamMember, 'backdropMode' | 'backdropFilms'>,
    topRatedFilms: Film[],
    sources: BackdropDataSources = {}
): FrameSource[] => {
    if (member.backdropMode === 'selected') {
        const chosen = (member.backdropFilms ?? [])
            .slice(0, BACKDROP_FILM_LIMIT)
            .map((imdbID) => resolveBackdropFilm(imdbID, sources).frame)
            .filter((frame) => frame.images.length > 0);

        if (chosen.length > 0) return chosen;
    }

    return toFrameSources(topRatedFilms);
};
