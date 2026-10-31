import { act, render } from '@testing-library/react';
import React from 'react';

import { useListEntrance } from './useListEntrance';

interface HarnessProps {
    ids: string[];
    onReady?: (prepareReplay: () => void) => void;
}

const Harness: React.FC<HarnessProps> = ({ ids, onReady }) => {
    const { containerRef, prepareReplay } = useListEntrance(ids);
    onReady?.(prepareReplay);
    return (
        <div ref={containerRef} data-testid="box">
            {ids.map((id) => (
                <div key={id} data-entrance={id} />
            ))}
        </div>
    );
};

describe('useListEntrance', () => {
    let animate: jest.Mock;
    let offScreen: Set<string>;
    let boxHeight: number;
    const realMatchMedia = window.matchMedia;

    /** Who was animated, in order, by `data-entrance`; the box is `box`. */
    const animated = (): string[] =>
        animate.mock.contexts.map(
            (element: HTMLElement) => element.dataset.entrance ?? element.dataset.testid ?? ''
        );

    beforeEach(() => {
        offScreen = new Set();
        boxHeight = 1000;
        animate = jest.fn(() => ({ cancel: jest.fn() }));
        Element.prototype.animate = animate;
        jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
            this: HTMLElement
        ) {
            const below = offScreen.has(this.dataset.entrance ?? '');
            return {
                top: below ? window.innerHeight + 100 : 10,
                bottom: below ? window.innerHeight + 200 : 50,
                height: this.dataset.testid === 'box' ? boxHeight : 40,
            } as DOMRect;
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        delete (Element.prototype as Partial<Element>).animate;
        window.matchMedia = realMatchMedia;
    });

    it('leaves first paint alone', () => {
        render(<Harness ids={['a', 'b']} />);
        expect(animate).not.toHaveBeenCalled();
    });

    it('animates only the items a growing list adds', () => {
        const { rerender } = render(<Harness ids={['a', 'b']} />);
        rerender(<Harness ids={['a', 'b', 'c', 'd']} />);
        expect(animated()).toEqual(['c', 'd']);
    });

    it('skips new items below the fold', () => {
        const { rerender } = render(<Harness ids={['a']} />);
        offScreen.add('c');
        rerender(<Harness ids={['a', 'b', 'c']} />);
        expect(animated()).toEqual(['b']);
    });

    it('replays every item and eases the height when the list is replaced', () => {
        let prepareReplay = () => {};
        const { rerender } = render(
            <Harness ids={['a', 'b']} onReady={(prepare) => (prepareReplay = prepare)} />
        );

        act(() => prepareReplay());
        boxHeight = 400;
        rerender(<Harness ids={['b', 'c']} />);

        expect(animated()).toEqual(['b', 'c', 'box']);
        const [keyframes] = animate.mock.calls[2];
        expect(keyframes[0].height).toBe('1000px');
        expect(keyframes[1].height).toBe('400px');
    });

    it('does not replay on the change after a replay', () => {
        let prepareReplay = () => {};
        const { rerender } = render(
            <Harness ids={['a']} onReady={(prepare) => (prepareReplay = prepare)} />
        );

        act(() => prepareReplay());
        rerender(<Harness ids={['b']} />);
        animate.mockClear();
        rerender(<Harness ids={['b', 'c']} />);

        expect(animated()).toEqual(['c']);
    });

    it('caps the stagger so a long list does not trail off', () => {
        const ids = Array.from({ length: 20 }, (_, index) => `row-${index}`);
        const { rerender } = render(<Harness ids={[]} />);
        rerender(<Harness ids={ids} />);

        const delays = animate.mock.calls.map(([, options]) => options.delay);
        expect(delays[1]).toBeGreaterThan(delays[0]);
        expect(delays[19]).toBe(delays[8]);
    });

    it('cancels what is still running before starting again', () => {
        const cancel = jest.fn();
        animate.mockImplementation(() => ({ cancel }));
        const { rerender } = render(<Harness ids={['a']} />);

        rerender(<Harness ids={['a', 'b']} />);
        expect(cancel).not.toHaveBeenCalled();
        rerender(<Harness ids={['a', 'b', 'c']} />);
        expect(cancel).toHaveBeenCalledTimes(1);
    });

    it('does nothing for a reader who asked for less motion', () => {
        window.matchMedia = jest.fn(() => ({ matches: true })) as unknown as typeof matchMedia;
        const { rerender } = render(<Harness ids={['a']} />);
        rerender(<Harness ids={['a', 'b']} />);
        expect(animate).not.toHaveBeenCalled();
    });

    it('renders without the Web Animations API', () => {
        delete (Element.prototype as Partial<Element>).animate;
        const { rerender } = render(<Harness ids={['a']} />);
        expect(() => rerender(<Harness ids={['a', 'b']} />)).not.toThrow();
    });
});
