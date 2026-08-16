import { IMAGE_URL_LIMIT, parseImageUrl } from './imageUrl';

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
