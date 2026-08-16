import { Film } from '../types/film';
import { getFilmBackdrops } from './filmUtils';

/**
 * What the background art on this site is drawn from.
 *
 * The frame system started out taking club films, which was enough while every
 * surface using it — the About banner, the almanac, a profile — was built out of
 * `films.json`. A member's list and watch log are not: most of what's on them
 * are films the club never watched, which have no `Film` record at all and only
 * a poster in the summary cache. This is the shape both kinds resolve to, so a
 * banner or a row doesn't care which side of that divide its art came from.
 */

/**
 * How an image wants to be framed. A still is already the right shape for a
 * wide panel; a poster is portrait and has to be zoomed hard to fill one, which
 * is a different number rather than a different code path.
 */
export type FrameImageKind = 'still' | 'poster';

export interface FrameImage {
    url: string;
    kind: FrameImageKind;
}

/** A film that can supply background art, and where a credit for it should link. */
export interface FrameSource {
    imdbID: string;
    title: string;
    /** Best first. Empty when the film has no artwork at all — callers skip it. */
    images: FrameImage[];
    /**
     * True when the film has a page on this site. A film the club never watched
     * doesn't, so its credit goes out to IMDb — the same rule the rows use for
     * their titles.
     */
    onSite: boolean;
}

/** A club film's own art: its scene stills, falling back to its poster. */
export const filmFrameSource = (film: Film): FrameSource => {
    const stills: FrameImage[] = getFilmBackdrops(film).map((url) => ({ url, kind: 'still' }));
    const poster: FrameImage[] =
        film.poster && !film.poster.includes('N/A') ? [{ url: film.poster, kind: 'poster' }] : [];

    return {
        imdbID: film.imdbID,
        title: film.title,
        images: [...stills, ...poster],
        onSite: true,
    };
};

export const toFrameSources = (films: Film[]): FrameSource[] => films.map(filmFrameSource);

/**
 * A row on a list or a watch log, in the only terms the art cares about. Both
 * `ResolvedListEntry` and `ResolvedWatchedEntry` satisfy this structurally, so
 * neither module has to know about this one.
 */
export interface FrameSubject {
    imdbID: string;
    title: string | null;
    /**
     * The poster as resolved for display, which is already the member's own if
     * they set one. Nothing here has to know the difference — a resolver
     * decided which poster this film has, and this is that poster.
     */
    poster: string | null;
    /** The member's own image link, if they set one. */
    image?: string | null;
    clubFilm?: Film;
}

/**
 * The art for one entry, in preference order: the member's own image, then the
 * club's stills if this is a film the club watched, then the poster.
 *
 * The member's link wins outright — it is the whole point of the field, and the
 * one they'd have set precisely because they didn't like what was there. It is
 * treated as a still: someone picking a background image picks a wide one, and
 * over-zooming a frame they chose is worse than under-zooming a poster they
 * didn't.
 */
export const entryFrameSource = (entry: FrameSubject): FrameSource => {
    const images: FrameImage[] = [];
    const add = (url: string | null | undefined, kind: FrameImageKind) => {
        if (url && !url.includes('N/A') && !images.some((image) => image.url === url)) {
            images.push({ url, kind });
        }
    };

    add(entry.image, 'still');
    if (entry.clubFilm) getFilmBackdrops(entry.clubFilm).forEach((url) => add(url, 'still'));
    add(entry.poster, 'poster');

    return {
        imdbID: entry.imdbID,
        title: entry.title ?? 'Unknown film',
        images,
        onSite: entry.clubFilm !== undefined,
    };
};

/** The single image a row washes behind itself, or null when it has none. */
export const entryFrameImage = (entry: FrameSubject): FrameImage | null =>
    entryFrameSource(entry).images[0] ?? null;

/**
 * One image to stand for a whole set of entries — a list card on a profile,
 * which is a list rather than a film.
 *
 * Kind beats position: the best still anywhere on the list wins over the poster
 * of whatever happens to sit at rank 1. A member's own image is a still by
 * definition, so the picture they deliberately chose is the one that surfaces,
 * and a card that would otherwise wash a poster behind a stack of posters gets
 * something else to show instead. Within a kind, the given order decides.
 */
export const collectionFrameImage = (entries: FrameSubject[]): FrameImage | null => {
    const images = entries.flatMap((entry) => entryFrameSource(entry).images);
    return images.find((image) => image.kind === 'still') ?? images[0] ?? null;
};
