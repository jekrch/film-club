import {
    IMAGE_URL_LIMIT,
    isImageSource,
    isSiteImagePath,
    parseImageUrl,
    parseSiteImageUrl,
} from './imageUrl';

describe('parseImageUrl', () => {
    it('keeps an https URL, trimmed', () => {
        expect(parseImageUrl('  https://img.example/still.jpg  ')).toEqual({
            value: 'https://img.example/still.jpg',
        });
    });

    it('treats blank, whitespace, and absent alike as unset', () => {
        expect(parseImageUrl('')).toEqual({ value: null });
        expect(parseImageUrl('   ')).toEqual({ value: null });
        expect(parseImageUrl(null)).toEqual({ value: null });
        expect(parseImageUrl(undefined)).toEqual({ value: null });
    });

    // The site is HTTPS, so an http image stores fine and then renders as
    // nothing at all — the failure worth catching in the form.
    it('rejects any scheme but https', () => {
        expect(parseImageUrl('http://img.example/still.jpg')).toEqual({
            error: expect.stringContaining('https://'),
        });
        expect(parseImageUrl('data:image/png;base64,iVBOR')).toEqual({
            error: expect.stringContaining('https://'),
        });
    });

    it('rejects something that is not a URL at all', () => {
        expect(parseImageUrl('img.example/still.jpg')).toEqual({
            error: expect.stringContaining('full URL'),
        });
    });

    it('caps the length the worker caps', () => {
        const long = `https://img.example/${'x'.repeat(IMAGE_URL_LIMIT)}.jpg`;
        expect(parseImageUrl(long)).toEqual({ error: expect.stringContaining('limit') });
    });
});

describe('parseSiteImageUrl', () => {
    it("keeps a path into the site's own images", () => {
        expect(parseSiteImageUrl(' /images/films/tt0116650-backdrop.jpg ')).toEqual({
            value: '/images/films/tt0116650-backdrop.jpg',
        });
    });

    it('refuses a protocol-relative URL or a climb out of the folder', () => {
        expect(parseSiteImageUrl('//evil.example/x.jpg')).toEqual({
            error: expect.stringContaining('/images/'),
        });
        expect(parseSiteImageUrl('/images/../secret.jpg')).toEqual({
            error: expect.stringContaining('/images/'),
        });
    });

    it('holds anything else to the https rule', () => {
        expect(parseSiteImageUrl('https://img.example/still.jpg')).toEqual({
            value: 'https://img.example/still.jpg',
        });
        expect(parseSiteImageUrl('http://img.example/still.jpg')).toEqual({
            error: expect.stringContaining('https://'),
        });
    });
});

describe('isImageSource', () => {
    it("takes a full URL or a path into the site's own images", () => {
        expect(isImageSource('https://image.tmdb.org/t/p/w1280/a.jpg')).toBe(true);
        expect(isImageSource('/images/films/tt0116650-backdrop.jpg')).toBe(true);
        expect(isSiteImagePath('/images/films/tt0116650-backdrop.jpg')).toBe(true);
    });

    it('turns away blanks, placeholders and other origins', () => {
        expect(isImageSource(undefined)).toBe(false);
        expect(isImageSource('')).toBe(false);
        expect(isImageSource('N/A')).toBe(false);
        expect(isImageSource('//evil.example/x.jpg')).toBe(false);
    });
});
