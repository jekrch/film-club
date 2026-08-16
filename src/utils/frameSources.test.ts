import {
    collectionFrameImage,
    entryFrameImage,
    entryFrameSource,
    filmFrameSource,
} from './frameSources';
import { makeFilm } from '../test-utils/factories';

const clubFilm = makeFilm({
    imdbID: 'tt0000001',
    title: 'A Club Film',
    poster: 'https://example.com/club-poster.jpg',
    backdropImage: 'https://example.com/curated.jpg',
    backdropImages: ['https://example.com/still-1.jpg'],
});

describe('filmFrameSource', () => {
    it('prefers a club film’s stills and keeps its poster as a fallback', () => {
        expect(filmFrameSource(clubFilm)).toEqual({
            imdbID: 'tt0000001',
            title: 'A Club Film',
            images: [
                { url: 'https://example.com/curated.jpg', kind: 'still' },
                { url: 'https://example.com/still-1.jpg', kind: 'still' },
                { url: 'https://example.com/club-poster.jpg', kind: 'poster' },
            ],
            onSite: true,
        });
    });

    it('leaves a film with no artwork out rather than framing nothing', () => {
        const bare = makeFilm({ imdbID: 'tt0000009', poster: 'N/A' });
        expect(filmFrameSource(bare).images).toEqual([]);
    });
});

describe('entryFrameSource', () => {
    // The whole point of the field: the member picked it precisely because they
    // didn't like what was already there.
    it('puts the member’s own image ahead of everything the film has', () => {
        const source = entryFrameSource({
            imdbID: 'tt0000001',
            title: 'A Club Film',
            poster: 'https://example.com/club-poster.jpg',
            image: 'https://example.com/mine.jpg',
            clubFilm,
        });
        expect(source.images[0]).toEqual({ url: 'https://example.com/mine.jpg', kind: 'still' });
        expect(source.onSite).toBe(true);
    });

    // A list-only film has a poster from the summary cache and nothing else,
    // which is why a member can supply their own.
    it('falls back to the poster for a film the club never watched', () => {
        const source = entryFrameSource({
            imdbID: 'tt0000002',
            title: 'A Cached Film',
            poster: 'https://example.com/cached.jpg',
        });
        expect(source.images).toEqual([{ url: 'https://example.com/cached.jpg', kind: 'poster' }]);
        // No page here, so a credit for it has to go out to IMDb.
        expect(source.onSite).toBe(false);
    });

    it('names an unresolved entry rather than crediting an empty string', () => {
        const source = entryFrameSource({ imdbID: 'tt0000003', title: null, poster: null });
        expect(source).toEqual({
            imdbID: 'tt0000003',
            title: 'Unknown film',
            images: [],
            onSite: false,
        });
    });

    it('does not list the same image twice', () => {
        const source = entryFrameSource({
            imdbID: 'tt0000001',
            title: 'A Club Film',
            poster: 'https://example.com/curated.jpg',
            image: 'https://example.com/curated.jpg',
            clubFilm,
        });
        expect(source.images.filter((image) => image.url.endsWith('curated.jpg'))).toHaveLength(1);
    });
});

describe('collectionFrameImage', () => {
    const cached = (imdbID: string, image?: string) => ({
        imdbID,
        title: 'A Cached Film',
        poster: `https://example.com/${imdbID}.jpg`,
        image,
    });

    // A list card washing a poster behind its own stack of posters is the case
    // this ordering exists to avoid.
    it('takes a still from anywhere on the list over the top row’s poster', () => {
        expect(collectionFrameImage([cached('tt0000002'), cached('tt0000003', 'https://mine.jpg')])).toEqual(
            { url: 'https://mine.jpg', kind: 'still' }
        );
    });

    it('settles for the first poster when the list has no stills at all', () => {
        expect(collectionFrameImage([cached('tt0000002'), cached('tt0000003')])).toEqual({
            url: 'https://example.com/tt0000002.jpg',
            kind: 'poster',
        });
    });

    it('is null for an empty list, and for one whose films have no art', () => {
        expect(collectionFrameImage([])).toBeNull();
        expect(collectionFrameImage([{ imdbID: 'tt0000003', title: null, poster: null }])).toBeNull();
    });
});

describe('entryFrameImage', () => {
    it('is the best image, or null when there is none', () => {
        expect(
            entryFrameImage({ imdbID: 'tt0000002', title: 'A Cached Film', poster: 'https://x/p.jpg' })
        ).toEqual({ url: 'https://x/p.jpg', kind: 'poster' });
        expect(entryFrameImage({ imdbID: 'tt0000003', title: null, poster: null })).toBeNull();
    });
});
