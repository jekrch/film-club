import {
    AVATAR_MAX_DIMENSION,
    MAX_SOURCE_BYTES,
    base64ByteLength,
    describeUploadProblem,
    fitWithin,
    splitDataUrl,
} from './imageUpload';

/**
 * The decisions an upload makes before it touches a canvas — which is all of
 * them that can be wrong in an interesting way. The drawing itself needs a real
 * browser and is left to the one place it can be checked: using it.
 */

describe('describeUploadProblem', () => {
    it('accepts the three types the worker will store', () => {
        for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
            expect(describeUploadProblem({ type, size: 1024 })).toBeNull();
        }
    });

    it('turns away a type the canvas may not decode', () => {
        expect(describeUploadProblem({ type: 'image/heic', size: 1024 })).toContain('JPEG');
    });

    it('turns away an animated GIF rather than flattening it', () => {
        // Excluded on both sides deliberately: the re-encode would drop the
        // animation, which is usually the reason someone chose the file.
        expect(describeUploadProblem({ type: 'image/gif', size: 1024 })).not.toBeNull();
    });

    it('turns away a file too large to decode comfortably', () => {
        const problem = describeUploadProblem({
            type: 'image/jpeg',
            size: MAX_SOURCE_BYTES + 1,
        });
        expect(problem).toContain('limit');
    });

    it('says which of the two problems it is', () => {
        expect(describeUploadProblem({ type: 'image/heic', size: 1024 })).not.toEqual(
            describeUploadProblem({ type: 'image/jpeg', size: MAX_SOURCE_BYTES + 1 })
        );
    });
});

describe('fitWithin', () => {
    it('shrinks a phone photograph to the stored size, keeping its shape', () => {
        expect(fitWithin(4032, 3024, AVATAR_MAX_DIMENSION)).toEqual({ width: 512, height: 384 });
    });

    it('fits by the long edge whichever edge that is', () => {
        expect(fitWithin(3024, 4032, AVATAR_MAX_DIMENSION)).toEqual({ width: 384, height: 512 });
    });

    it('leaves a small image alone rather than upscaling it', () => {
        // Blowing a 200px avatar up to 512 adds bytes and no detail.
        expect(fitWithin(200, 150, AVATAR_MAX_DIMENSION)).toEqual({ width: 200, height: 150 });
    });

    it('keeps a pixel on each edge of an extreme panorama', () => {
        // Rounding a 4000×3 strip by its long edge would otherwise give a
        // zero-height canvas, which throws instead of producing a bad image.
        expect(fitWithin(4000, 3, AVATAR_MAX_DIMENSION)).toEqual({ width: 512, height: 1 });
    });

    it('survives an image that reports no size at all', () => {
        expect(fitWithin(0, 0, AVATAR_MAX_DIMENSION)).toEqual({ width: 0, height: 0 });
    });
});

describe('splitDataUrl', () => {
    it('separates the type from the payload', () => {
        expect(splitDataUrl('data:image/jpeg;base64,AAAA')).toEqual({
            contentType: 'image/jpeg',
            data: 'AAAA',
        });
    });

    it('reads a type that carries extra parameters', () => {
        expect(splitDataUrl('data:image/jpeg;charset=utf-8;base64,AAAA')?.contentType).toBe(
            'image/jpeg'
        );
    });

    it('refuses a string that is not a base64 data URL', () => {
        expect(splitDataUrl('https://example.com/a.jpg')).toBeNull();
        expect(splitDataUrl('data:image/jpeg,notbase64')).toBeNull();
    });
});

describe('base64ByteLength', () => {
    it('counts three bytes for every four characters', () => {
        expect(base64ByteLength('AAAA')).toBe(3);
    });

    it('discounts the padding', () => {
        expect(base64ByteLength('AAA=')).toBe(2);
        expect(base64ByteLength('AA==')).toBe(1);
    });

    it('agrees with what the browser actually encoded', () => {
        const encoded = btoa('a picture, more or less');
        expect(base64ByteLength(encoded)).toBe('a picture, more or less'.length);
    });
});
