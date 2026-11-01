import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    PAGE_BG,
    SLATE_100,
    SLATE_300,
    SLATE_400,
    SLATE_500,
    SLATE_600,
    SLATE_800,
} from './chartTheme';

// The palette lives in the @theme block of index.css. These are the places that
// can't read a CSS variable and restate it. A page colour that drifts in any of
// them shows up as a seam: the status bar and toolbar on iOS, the splash screen,
// the gaps between a chart's slices.
const read = (path: string): string => readFileSync(resolve(__dirname, '../..', path), 'utf8');

const css = read('src/index.css');
const token = (name: string): string | undefined =>
    css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`))?.[1];

const page = token('page');

describe('the palette', () => {
    it('defines the page colour', () => {
        expect(page).toMatch(/^#[0-9a-f]{6}$/);
    });

    it('states the page colour in the browser theme colour', () => {
        expect(read('index.html')).toContain(`<meta name="theme-color" content="${page}" />`);
    });

    it('states the page colour in the PWA manifest', () => {
        const config = read('vite.config.ts');
        expect(config).toContain(`theme_color: '${page}'`);
        expect(config).toContain(`background_color: '${page}'`);
    });

    it('draws the favicon from the current page colour', () => {
        expect(read('public/pillar.svg')).toContain(`fill="${page}"`);
    });

    it('gives the charts the page colour and the slates of the ramp', () => {
        expect(PAGE_BG).toBe(page);
        expect(SLATE_100).toBe(token('slate-100'));
        expect(SLATE_300).toBe(token('slate-300'));
        expect(SLATE_400).toBe(token('slate-400'));
        expect(SLATE_500).toBe(token('slate-500'));
        expect(SLATE_600).toBe(token('slate-600'));
        expect(SLATE_800).toBe(token('slate-800'));
    });
});
