import { allowedImageUrl } from './imageProxy';

const POSTER =
    'https://s3.amazonaws.com/criterion-production/films/06ca64e64f53a32a330eb79247c5dd6b/hpbmGuJ0K6p12f6Y2bcZSk0BaKAUs1_medium.jpg';

describe('allowedImageUrl', () => {
    it("allows Criterion's bucket, by path or by its own host", () => {
        expect(allowedImageUrl(POSTER)?.toString()).toBe(POSTER);
        expect(
            allowedImageUrl('https://criterion-production.s3.amazonaws.com/janus_stills/a.jpg')
        ).not.toBeNull();
    });

    it("allows TMDb's stills and Amazon's posters, and nothing else on those hosts", () => {
        expect(allowedImageUrl('https://image.tmdb.org/t/p/w1280/b.jpg')).not.toBeNull();
        expect(allowedImageUrl('https://image.tmdb.org/t/p/original/b.jpg')).not.toBeNull();
        expect(
            allowedImageUrl('https://m.media-amazon.com/images/M/MV5Bxyz._V1_SX300.jpg')
        ).not.toBeNull();
        expect(allowedImageUrl('https://image.tmdb.org/other/b.jpg')).toBeNull();
        expect(allowedImageUrl('https://m.media-amazon.com/other/b.jpg')).toBeNull();
    });

    it('refuses other buckets, other hosts, and lookalikes', () => {
        expect(allowedImageUrl('https://s3.amazonaws.com/some-other-bucket/a.jpg')).toBeNull();
        expect(
            allowedImageUrl('https://s3.amazonaws.com/criterion-production-evil/a.jpg')
        ).toBeNull();
        expect(allowedImageUrl('https://example.com/criterion-production/a.jpg')).toBeNull();
        expect(
            allowedImageUrl('https://s3.amazonaws.com.evil.com/criterion-production/a.jpg')
        ).toBeNull();
    });

    it('refuses anything but plain https, and ways out of the allowed path', () => {
        expect(allowedImageUrl(POSTER.replace('https:', 'http:'))).toBeNull();
        expect(
            allowedImageUrl('https://user:pw@s3.amazonaws.com/criterion-production/a.jpg')
        ).toBeNull();
        expect(
            allowedImageUrl('https://s3.amazonaws.com:8443/criterion-production/a.jpg')
        ).toBeNull();
        expect(
            allowedImageUrl('https://s3.amazonaws.com/criterion-production/%2e%2e/other/a.jpg')
        ).toBeNull();
        expect(
            allowedImageUrl('https://s3.amazonaws.com/criterion-production/../other/a.jpg')
        ).toBeNull();
    });

    it('refuses nothing at all, and nonsense', () => {
        expect(allowedImageUrl(null)).toBeNull();
        expect(allowedImageUrl('')).toBeNull();
        expect(allowedImageUrl('not a url')).toBeNull();
    });
});
