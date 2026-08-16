import { parseTrailerLink, resolveTrailerKey, TRAILER_URL_LIMIT } from './youtube';

const KEY = 'dQw4w9WgXcQ';

describe('parseTrailerLink', () => {
    it('takes every shape of link a member is likely to have copied', () => {
        const links = [
            `https://www.youtube.com/watch?v=${KEY}`,
            `https://www.youtube.com/watch?v=${KEY}&t=42s&list=PL123`,
            `https://m.youtube.com/watch?v=${KEY}`,
            `https://youtu.be/${KEY}`,
            `https://youtu.be/${KEY}?t=42`,
            `https://www.youtube-nocookie.com/embed/${KEY}`,
            `https://www.youtube.com/shorts/${KEY}`,
            // Pasted without the scheme, which is what a browser's address bar
            // hands over on a copy.
            `youtube.com/watch?v=${KEY}`,
            // And the id alone, out of a URL someone already trimmed.
            KEY,
        ];

        for (const link of links) {
            expect(parseTrailerLink(link)).toEqual({ value: KEY });
        }
    });

    it('reads a blank field as "use the film\'s own trailer"', () => {
        expect(parseTrailerLink('')).toEqual({ value: null });
        expect(parseTrailerLink('   ')).toEqual({ value: null });
        expect(parseTrailerLink(null)).toEqual({ value: null });
        expect(parseTrailerLink(undefined)).toEqual({ value: null });
    });

    it('refuses anything that is not a YouTube video', () => {
        // A different site, a YouTube page with no video on it, and an id of the
        // wrong length — all of which would otherwise reach an iframe src.
        for (const bad of [
            'https://vimeo.com/76979871',
            'https://www.youtube.com/results?search_query=trailer',
            'https://www.youtube.com/watch?v=short',
            'not a link at all',
            `${KEY}x`,
        ]) {
            expect(parseTrailerLink(bad)).toHaveProperty('error');
        }
    });

    it('caps the length before it parses anything', () => {
        const long = `https://www.youtube.com/watch?v=${KEY}&pad=${'x'.repeat(TRAILER_URL_LIMIT)}`;
        expect(parseTrailerLink(long)).toHaveProperty('error');
    });
});

describe('resolveTrailerKey', () => {
    const film = { trailerKey: 'FILMTRAILER' };

    it("falls back to the film's own trailer", () => {
        expect(resolveTrailerKey({}, film)).toBe('FILMTRAILER');
        expect(resolveTrailerKey({ trailerKey: null }, film)).toBe('FILMTRAILER');
    });

    it("prefers the member's own link", () => {
        expect(resolveTrailerKey({ trailerKey: KEY }, film)).toBe(KEY);
    });

    it('plays nothing when the member hid it, whatever anyone knows', () => {
        expect(resolveTrailerKey({ hideTrailer: true }, film)).toBeNull();
        expect(resolveTrailerKey({ trailerKey: KEY, hideTrailer: true }, film)).toBeNull();
    });

    it('answers null when neither side has one', () => {
        expect(resolveTrailerKey({}, null)).toBeNull();
        expect(resolveTrailerKey({}, { trailerKey: null })).toBeNull();
        // A summary CI has not looked up yet, which is not the same as no trailer
        // but renders the same until it has.
        expect(resolveTrailerKey({}, {})).toBeNull();
    });
});
