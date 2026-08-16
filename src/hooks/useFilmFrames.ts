import { useMemo } from 'react';
import { Film } from '../types/film';
import { FrameImageKind, FrameSource, toFrameSources } from '../utils/frameSources';

/**
 * A still pulled from a film, framed for use as background art: which portion
 * of the image to show and how hard to zoom it.
 */
export interface FilmFrame {
    imdbID: string;
    title: string;
    image: string;
    scale: number;
    clipX: number;
    clipY: number;
    /** What was picked, for layouts that need to reframe it themselves. */
    kind: FrameImageKind;
    /** False when the film has no page here, so the credit links out to IMDb. */
    onSite: boolean;
}

const pickRandom = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

/**
 * Cheap identity for a set of sources: enough to notice a film swapped in or a
 * member changing their image link, without stringifying every pool. Depending
 * on the array itself would re-roll every frame on every render, and callers
 * routinely build the list inline (`person.filmography.map(c => c.film)`).
 */
const sourceKey = (sources: FrameSource[]): string =>
    sources
        .map((source) => `${source.imdbID}:${source.images.length}:${source.images[0]?.url ?? ''}`)
        .join('|');

/**
 * Up to `count` frames, each from a different film and each showing a random
 * portion of a random image — so a banner is a different cut of the collection
 * on every page load. Fewer frames come back when not enough films have imagery;
 * callers decide what their minimum is.
 */
export const useFrames = (sources: FrameSource[], count: number): FilmFrame[] => {
    const key = sourceKey(sources);

    return useMemo(() => {
        const candidates = sources.filter((source) => source.images.length > 0);
        const shuffled = [...candidates].sort(() => Math.random() - 0.5);

        return shuffled.slice(0, count).map((source) => {
            const picked = pickRandom(source.images);
            const isPoster = picked.kind === 'poster';
            return {
                imdbID: source.imdbID,
                title: source.title,
                image: picked.url,
                kind: picked.kind,
                onSite: source.onSite,
                // Posters are portrait, so they need a hard zoom to fill a tall
                // column; wide stills only need a gentle one
                scale: isPoster ? 1.8 : 1.15,
                // Random portion of the image to show
                clipX: 20 + Math.random() * 60,
                clipY: isPoster ? 10 + Math.random() * 50 : 25 + Math.random() * 50,
            };
        });
        // `key` stands in for `sources`; see the note on `sourceKey`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, count]);
};

/** {@link useFrames} for callers that hold club films, which is most of them. */
export const useFilmFrames = (films: Film[], count: number): FilmFrame[] =>
    useFrames(toFrameSources(films), count);
