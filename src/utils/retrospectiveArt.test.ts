import type { FrameImage } from './frameSources';
import { wallColumns } from './retrospectiveArt';

const art = (count: number): FrameImage[] =>
    Array.from({ length: count }, (_, i) => ({
        url: `https://img.test/${i}.jpg`,
        kind: i % 4 === 0 ? 'poster' : 'still',
    }));

describe('wallColumns', () => {
    it('fills every column to the requested length', () => {
        const columns = wallColumns(art(10), 6, 14);
        expect(columns).toHaveLength(6);
        columns.forEach((column) => expect(column).toHaveLength(14));
    });

    it('uses every image before repeating any', () => {
        const first = wallColumns(art(30), 3, 10)
            .flatMap((column, c) => column.map((image, row) => ({ image, at: row * 3 + c })))
            .sort((a, b) => a.at - b.at)
            .slice(0, 30)
            .map(({ image }) => image.url);
        expect(new Set(first).size).toBe(30);
    });

    it('does not lay the same pass in the same order twice', () => {
        const columns = wallColumns(art(12), 1, 36);
        const passes = [0, 12, 24].map((start) =>
            columns[0]
                .slice(start, start + 12)
                .map((image) => image.url)
                .join()
        );
        expect(new Set(passes).size).toBe(3);
    });

    it('keeps a new pass from opening with what the last one just showed', () => {
        const columns = 6;
        const flat = wallColumns(art(20), columns, 20);
        const sequence = flat[0].flatMap((_, row) => flat.map((column) => column[row]));
        for (let pass = 20; pass < sequence.length; pass += 20) {
            const tail = new Set(sequence.slice(pass - columns, pass).map((i) => i.url));
            sequence.slice(pass, pass + columns).forEach((image) => {
                expect(tail.has(image.url)).toBe(false);
            });
        }
    });

    it('is stable for the same art and drops duplicate urls', () => {
        const images = [...art(8), ...art(8)];
        expect(wallColumns(images, 4, 6)).toEqual(wallColumns(images, 4, 6));
        const firstPass = wallColumns(images, 1, 8)[0].map((image) => image.url);
        expect(new Set(firstPass).size).toBe(8);
    });

    it('returns empty columns when there is no art', () => {
        expect(wallColumns([], 3, 5)).toEqual([[], [], []]);
    });
});
