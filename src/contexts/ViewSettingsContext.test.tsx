import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

import { CARD_SIZES, ViewSettingsProvider, useViewSettings } from './ViewSettingsContext';

/**
 * The card-size preference is the one piece of user state the site persists on
 * its own, and it survives a reload only if the write and the read agree on
 * what a valid size is. They had drifted — `poster` could be set but not
 * restored — which is the regression these tests exist to hold shut.
 */

const KEY = 'appViewSettings';

const wrapper = ({ children }: { children: ReactNode }) => (
    <ViewSettingsProvider>{children}</ViewSettingsProvider>
);

const render = () => renderHook(() => useViewSettings(), { wrapper });

beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
});

describe('initial value', () => {
    it('defaults to compact with nothing stored', () => {
        expect(render().result.current.cardSize).toBe('compact');
    });

    // Every size the type allows must survive a reload. The poster case is the
    // one that used to fail.
    it.each(CARD_SIZES)('restores %s from a previous session', (size) => {
        localStorage.setItem(KEY, JSON.stringify({ cardSize: size }));
        expect(render().result.current.cardSize).toBe(size);
    });

    it('falls back to compact when the stored value is not a size', () => {
        localStorage.setItem(KEY, JSON.stringify({ cardSize: 'gigantic' }));
        expect(render().result.current.cardSize).toBe('compact');
    });

    // Corrupt storage must not take the whole app down on first paint, since
    // this runs inside a useState initialiser.
    it('survives malformed JSON without throwing', () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        localStorage.setItem(KEY, 'not json at all');

        expect(() => render()).not.toThrow();
        expect(render().result.current.cardSize).toBe('compact');
    });

    it('survives a stored object with no cardSize at all', () => {
        localStorage.setItem(KEY, JSON.stringify({ somethingElse: true }));
        expect(render().result.current.cardSize).toBe('compact');
    });
});

describe('setCardSize', () => {
    it('updates the value and writes it back to storage', () => {
        const { result } = render();

        act(() => result.current.setCardSize('poster'));

        expect(result.current.cardSize).toBe('poster');
        expect(JSON.parse(localStorage.getItem(KEY) as string)).toEqual({ cardSize: 'poster' });
    });

    // A round trip is the actual contract: what one session saves, the next
    // must read back.
    it.each(CARD_SIZES)('round-trips %s through storage into a new provider', (size) => {
        const first = render();
        act(() => first.result.current.setCardSize(size));

        expect(render().result.current.cardSize).toBe(size);
    });

    it('ignores a value that is not a size and keeps the current one', () => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        const { result } = render();

        act(() => result.current.setCardSize('gigantic' as never));

        expect(result.current.cardSize).toBe('compact');
    });
});

describe('useViewSettings', () => {
    // Rendering the hook outside the provider is a wiring mistake, and failing
    // loudly beats silently handing back undefined.
    it('throws when used outside a provider', () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => renderHook(() => useViewSettings())).toThrow(/within a ViewSettingsProvider/);
    });
});
