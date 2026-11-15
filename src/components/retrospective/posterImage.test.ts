import { canvasUrl, fullSize, keyArtOrder, shelfPicks } from './posterImage';

describe('shelfPicks', () => {
    it('shows every pick when they fit', () => {
        expect(shelfPicks([1, 2, 3])).toEqual({ shown: [1, 2, 3], more: 0 });
        expect(shelfPicks([1, 2, 3, 4, 5])).toEqual({ shown: [1, 2, 3, 4, 5], more: 0 });
    });

    it('gives the last place to a count of the rest when there are too many', () => {
        expect(shelfPicks([1, 2, 3, 4, 5, 6, 7])).toEqual({ shown: [1, 2, 3, 4], more: 3 });
    });
});

describe('keyArtOrder', () => {
    it('puts stills the canvas can draw first, keeping their order, and drops repeats', () => {
        expect(
            keyArtOrder([
                'https://s3.amazonaws.com/criterion-production/a.jpg',
                'https://image.tmdb.org/t/p/w1280/b.jpg',
                'N/A',
                'https://m.media-amazon.com/images/c.jpg',
                'https://image.tmdb.org/t/p/w1280/b.jpg',
            ])
        ).toEqual([
            'https://image.tmdb.org/t/p/w1280/b.jpg',
            'https://m.media-amazon.com/images/c.jpg',
            'https://s3.amazonaws.com/criterion-production/a.jpg',
        ]);
    });
});

describe('fullSize', () => {
    it('asks TMDb for the original, and leaves anything else alone', () => {
        expect(fullSize('https://image.tmdb.org/t/p/w1280/b.jpg')).toBe(
            'https://image.tmdb.org/t/p/original/b.jpg'
        );
        expect(fullSize('https://m.media-amazon.com/images/c.jpg')).toBe(
            'https://m.media-amazon.com/images/c.jpg'
        );
    });
});

describe('canvasUrl', () => {
    const criterion = 'https://s3.amazonaws.com/criterion-production/films/x/poster_medium.jpg';

    it("sends Criterion's images through the worker's proxy", () => {
        expect(canvasUrl(criterion, 'https://worker.example')).toBe(
            `https://worker.example/img?url=${encodeURIComponent(criterion)}`
        );
    });

    it('leaves hosts with CORS alone, and everything alone without a worker', () => {
        expect(canvasUrl('https://m.media-amazon.com/images/c.jpg', 'https://worker.example')).toBe(
            'https://m.media-amazon.com/images/c.jpg'
        );
        expect(canvasUrl(criterion, '')).toBe(criterion);
    });

    it("counts Criterion's stills as drawable once there's a proxy", () => {
        const tmdb = 'https://image.tmdb.org/t/p/w1280/b.jpg';
        expect(keyArtOrder([criterion, tmdb], 'https://worker.example')).toEqual([criterion, tmdb]);
        expect(keyArtOrder([criterion, tmdb], '')).toEqual([tmdb, criterion]);
    });
});
