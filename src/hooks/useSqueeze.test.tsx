import React from 'react';
import { act, render } from '@testing-library/react';
import { useSqueeze } from './useSqueeze';

/**
 * jsdom neither lays out nor observes resizes, so the test stands in a frame
 * of a known height, content whose height follows `--squeeze` by a known
 * rule, and a ResizeObserver it can fire by hand.
 */
let observers: { callback: () => void }[] = [];

class FakeResizeObserver {
    constructor(callback: () => void) {
        observers.push({ callback });
    }
    observe() {}
    disconnect() {}
}

const Box: React.FC = () => {
    const fit = useSqueeze();
    return (
        <div ref={fit.frameRef} data-testid="frame">
            <div ref={fit.contentRef} />
        </div>
    );
};

/** A frame `room` tall whose content is `natural` tall and loses `give` at full squeeze. */
function mount(room: number, natural: number, give: number) {
    const frame = render(<Box />).getByTestId('frame');
    Object.defineProperty(frame, 'clientHeight', { configurable: true, get: () => room });
    Object.defineProperty(frame, 'scrollHeight', {
        configurable: true,
        get: () =>
            Math.max(
                room,
                natural - give * parseFloat(frame.style.getPropertyValue('--squeeze') || '0')
            ),
    });
    act(() => observers.forEach((o) => o.callback()));
    return frame;
}

const squeezeOf = (frame: HTMLElement) => frame.style.getPropertyValue('--squeeze');

beforeEach(() => {
    observers = [];
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = FakeResizeObserver;
});

afterEach(() => {
    delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
});

describe('useSqueeze', () => {
    it('leaves a slide that fits alone', () => {
        expect(squeezeOf(mount(600, 500, 300))).toBe('');
    });

    it('squeezes a slide that nearly fits just enough', () => {
        expect(squeezeOf(mount(600, 750, 300))).toBe('0.5');
    });

    it('finds the least squeeze to within a percent', () => {
        const squeeze = parseFloat(squeezeOf(mount(600, 700, 300)));
        expect(squeeze).toBeGreaterThanOrEqual(1 / 3);
        expect(squeeze).toBeLessThan(1 / 3 + 1 / 64);
    });

    it('leaves a slide that cannot fit to scroll at full size', () => {
        expect(squeezeOf(mount(600, 1000, 300))).toBe('');
    });

    it('settles: measuring again gives the same answer', () => {
        const frame = mount(600, 750, 300);
        act(() => observers.forEach((o) => o.callback()));
        expect(squeezeOf(frame)).toBe('0.5');
    });
});
