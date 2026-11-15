import { findFilmSummary } from '../api/filmSummaries';
import { filmData, type Film } from '../types/film';
import type { FrameImage } from './frameSources';
import { getFilmBackdrops } from './filmUtils';
import type { LoggedFilm } from './retrospectiveUtils';

/**
 * Stills taken per film, so one film with forty frames doesn't paper the wall.
 * A club year is only ten to sixteen films, so this has to be generous enough
 * that the wall isn't the same few frames over and over.
 */
const STILLS_PER_FILM = 4;

const usable = (url: string | null | undefined): url is string =>
    !!url && url.startsWith('http') && !url.includes('N/A');

/**
 * A film's art as the mosaic lays it: the one-sheet first, then a handful of
 * stills. Posters and stills from the same film sit apart once the films are
 * interleaved by {@link yearArt}, so the wall reads as the year, not as a
 * film-by-film slideshow.
 */
const filmArt = (poster: string | null | undefined, stills: string[]): FrameImage[] => [
    ...(usable(poster) ? [{ url: poster, kind: 'poster' as const }] : []),
    ...stills
        .filter(usable)
        .slice(0, STILLS_PER_FILM)
        .map((url) => ({ url, kind: 'still' as const })),
];

/**
 * The year's art, round-robin across films: every film's poster, then every
 * film's first still, then every second still. Duplicates — a film both
 * screened and logged — appear once.
 */
export const yearArt = (films: Film[], logged: LoggedFilm[] = []): FrameImage[] => {
    const perFilm = [
        ...films.map((film) => filmArt(film.poster, getFilmBackdrops(film))),
        ...logged.map((l) => filmArt(l.poster, l.stills)),
    ];
    const seen = new Set<string>();
    const out: FrameImage[] = [];
    const rounds = Math.max(0, ...perFilm.map((art) => art.length));
    for (let round = 0; round < rounds; round++) {
        perFilm.forEach((art) => {
            const image = art[round];
            if (image && !seen.has(image.url)) {
                seen.add(image.url);
                out.push(image);
            }
        });
    }
    return out;
};

let clubIndex: Map<string, Film> | null = null;

/**
 * A film's scene stills, wherever this page knows them from: a club film's own
 * backdrops, or the summary cache for anything else. Empty for a film with none.
 */
export const stillsFor = (imdbID: string): string[] => {
    clubIndex ??= new Map(filmData.map((film) => [film.imdbID, film]));
    const club = clubIndex.get(imdbID);
    if (club) return getFilmBackdrops(club).filter(usable);
    return (findFilmSummary(imdbID)?.backdropImages ?? []).filter(usable);
};

/** A small seeded PRNG (mulberry32), so the wall lays out the same way on every render. */
const seededRandom = (seed: number) => {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

const hashString = (text: string): number => {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
};

/**
 * Lays the year's art into `columns` columns of `perColumn` tiles each, for the
 * mosaic wall.
 *
 * The art is drawn from a shuffled bag that is reshuffled whenever it runs dry,
 * so a short year repeats in a different order each pass rather than as one
 * list stamped over and over. Tiles are then dealt across the columns, so an
 * image's next appearance in the same column is a whole bag away. Where one
 * pass meets the next, the new pass is kept from opening with anything the
 * last one just showed. Seeded by the art itself, so the layout is stable.
 */
export const wallColumns = (
    images: FrameImage[],
    columns: number,
    perColumn: number
): FrameImage[][] => {
    const unique = images.filter(
        (image, index) => images.findIndex((other) => other.url === image.url) === index
    );
    const out: FrameImage[][] = Array.from({ length: columns }, () => []);
    if (!unique.length || columns <= 0 || perColumn <= 0) return out;

    const random = seededRandom(hashString(unique.map((image) => image.url).join('|')));
    const total = columns * perColumn;
    // How far back a fresh pass looks to keep from echoing the last one.
    const guard = Math.min(columns, Math.floor(unique.length / 2));
    const sequence: FrameImage[] = [];

    while (sequence.length < total) {
        const bag = [...unique];
        for (let i = bag.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [bag[i], bag[j]] = [bag[j], bag[i]];
        }
        const recent = new Set(sequence.slice(-guard).map((image) => image.url));
        for (let i = 0; i < guard; i++) {
            if (!recent.has(bag[i].url)) continue;
            const swap = bag.findIndex((image, j) => j >= guard && !recent.has(image.url));
            if (swap !== -1) [bag[i], bag[swap]] = [bag[swap], bag[i]];
        }
        sequence.push(...bag);
    }

    sequence.slice(0, total).forEach((image, index) => out[index % columns].push(image));
    return out;
};
