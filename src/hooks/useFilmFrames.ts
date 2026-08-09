import { useMemo } from 'react';
import { Film } from '../types/film';
import { getFilmBackdrops } from '../utils/filmUtils';

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
}

/**
 * The image pool for a film: its scene stills when it has any, otherwise its
 * poster as a fallback. Returns an empty array when the film has neither.
 */
const getFilmImages = (film: Film): string[] => {
    const stills = getFilmBackdrops(film);
    if (stills.length > 0) return stills;
    if (film.poster && !film.poster.includes('N/A')) return [film.poster];
    return [];
};

const pickRandom = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

/**
 * Up to `count` frames, each from a different film and each showing a random
 * portion of a random still — so a banner is a different cut of the collection
 * on every page load. Fewer frames come back when not enough films have
 * imagery; callers decide what their minimum is.
 *
 * Keyed on the films' IDs rather than the array's identity: callers routinely
 * build the list inline (`person.filmography.map(c => c.film)`), and depending
 * on identity would re-roll every frame on every render.
 */
export const useFilmFrames = (films: Film[], count: number): FilmFrame[] => {
    const key = films.map(film => film.imdbID).join('|');

    return useMemo(() => {
        const candidates = films
            .map(film => ({ film, images: getFilmImages(film) }))
            .filter(({ images }) => images.length > 0);

        const shuffled = [...candidates].sort(() => Math.random() - 0.5);

        return shuffled.slice(0, count).map(({ film, images }) => {
            const image = pickRandom(images);
            const isPoster = image === film.poster;
            return {
                imdbID: film.imdbID,
                title: film.title,
                image,
                // Posters are portrait, so they need a hard zoom to fill a tall
                // column; wide stills only need a gentle one
                scale: isPoster ? 1.8 : 1.15,
                // Random portion of the image to show
                clipX: 20 + Math.random() * 60,
                clipY: isPoster ? 10 + Math.random() * 50 : 25 + Math.random() * 50,
            };
        });
        // `key` stands in for `films`; depending on the array itself would
        // re-roll every frame on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, count]);
};
