import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../../utils/motion';

interface ScorePickerProps {
    /** `apart` sets a choice off from the ones after it with a hairline. */
    choices: { id: string; label: string; apart?: boolean }[];
    selectedId: string;
    onChoose: (id: string) => void;
    accent: string;
}

/** How far each end fades out, and the room left past the first and last pill. */
const FADE = '2.5rem';
/** How far a press has to travel before it's a drag rather than a tap. */
const DRAG_THRESHOLD = 5;
/** How much of the release speed a glide keeps every 16ms. */
const FRICTION = 0.94;

/**
 * The cover's choice of music, as one centred row of pills that fades out at
 * both ends. When the row is wider than its room, it scrolls: swiped on
 * touch, dragged with a mouse (and glides on after a flick), or turned with
 * the wheel. The chosen pill is brought to the middle.
 */
const ScorePicker: React.FC<ScorePickerProps> = ({ choices, selectedId, onChoose, accent }) => {
    const scrollerRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const [overflowing, setOverflowing] = useState(false);
    const [dragging, setDragging] = useState(false);

    // One animation at a time moves the row: a glide after a drag, or an
    // ease towards a target for the wheel and the chosen pill.
    const frame = useRef<number | null>(null);
    const target = useRef(0);
    const stop = useCallback(() => {
        if (frame.current !== null) cancelAnimationFrame(frame.current);
        frame.current = null;
    }, []);
    useEffect(() => stop, [stop]);

    const maxScroll = (el: HTMLElement) => Math.max(0, el.scrollWidth - el.clientWidth);

    const easeTo = useCallback(
        (left: number) => {
            const el = scrollerRef.current;
            if (!el) return;
            target.current = Math.min(maxScroll(el), Math.max(0, left));
            if (prefersReducedMotion()) {
                stop();
                el.scrollLeft = target.current;
                return;
            }
            if (frame.current !== null) return;
            const tick = () => {
                const gap = target.current - el.scrollLeft;
                if (Math.abs(gap) < 0.5) {
                    el.scrollLeft = target.current;
                    frame.current = null;
                    return;
                }
                el.scrollLeft += gap * 0.18;
                frame.current = requestAnimationFrame(tick);
            };
            frame.current = requestAnimationFrame(tick);
        },
        [stop]
    );

    // Whether there's anything to scroll: the fades and the grab cursor only
    // appear when there is.
    useLayoutEffect(() => {
        const el = scrollerRef.current;
        const list = listRef.current;
        if (!el || !list) return;
        const measure = () => setOverflowing(el.scrollWidth > el.clientWidth + 1);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        observer.observe(list);
        return () => observer.disconnect();
    }, []);

    // The chosen pill to the middle: eased when the choice changes, at once on
    // first paint and when the row's padding comes or goes.
    const centred = useRef<string | null>(null);
    useLayoutEffect(() => {
        const el = scrollerRef.current;
        const pill = el?.querySelector<HTMLElement>('[aria-pressed="true"]');
        if (!el || !pill) return;
        const left = pill.offsetLeft - (el.clientWidth - pill.offsetWidth) / 2;
        if (centred.current !== null && centred.current !== selectedId) {
            easeTo(left);
        } else {
            stop();
            el.scrollLeft = left;
        }
        centred.current = selectedId;
    }, [selectedId, overflowing, easeTo, stop]);

    // A vertical wheel turns the row sideways, until it reaches an end; then
    // the page scrolls as usual. Horizontal trackpad swipes are left native.
    useEffect(() => {
        const el = scrollerRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) {
                stop();
                return;
            }
            const max = maxScroll(el);
            const from = frame.current !== null ? target.current : el.scrollLeft;
            if (max <= 0 || (e.deltaY < 0 && from <= 0) || (e.deltaY > 0 && from >= max - 1)) {
                return;
            }
            e.preventDefault();
            easeTo(from + (e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY));
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [easeTo, stop]);

    // Dragging with a mouse. Touch already scrolls natively, with its own
    // momentum, so only a mouse is handled here.
    const drag = useRef<{
        id: number;
        x: number;
        left: number;
        moved: boolean;
        trail: { t: number; x: number }[];
    } | null>(null);
    const swallowClick = useRef(false);

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        swallowClick.current = false;
        if (e.pointerType !== 'mouse' || e.button !== 0 || !overflowing) return;
        stop();
        drag.current = {
            id: e.pointerId,
            x: e.clientX,
            left: e.currentTarget.scrollLeft,
            moved: false,
            trail: [{ t: e.timeStamp, x: e.clientX }],
        };
    };

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const d = drag.current;
        if (!d || e.pointerId !== d.id) return;
        const dx = e.clientX - d.x;
        if (!d.moved) {
            if (Math.abs(dx) < DRAG_THRESHOLD) return;
            d.moved = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            setDragging(true);
        }
        e.currentTarget.scrollLeft = d.left - dx;
        d.trail.push({ t: e.timeStamp, x: e.clientX });
        while (d.trail.length > 2 && e.timeStamp - d.trail[0].t > 100) d.trail.shift();
    };

    const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
        const d = drag.current;
        if (!d || e.pointerId !== d.id) return;
        drag.current = null;
        if (!d.moved) return;
        setDragging(false);
        // The click that ends a drag isn't a choice.
        swallowClick.current = true;
        if (prefersReducedMotion()) return;

        // Glide on at the speed of release, slowing to a stop.
        const first = d.trail[0];
        const last = d.trail[d.trail.length - 1];
        const fresh = e.timeStamp - last.t < 60;
        let velocity = fresh && last.t > first.t ? -(last.x - first.x) / (last.t - first.t) : 0;
        const el = e.currentTarget;
        let previous = performance.now();
        const tick = (now: number) => {
            const dt = Math.min(32, now - previous);
            previous = now;
            el.scrollLeft += velocity * dt;
            velocity *= Math.pow(FRICTION, dt / 16);
            const atEnd = el.scrollLeft <= 0 || el.scrollLeft >= maxScroll(el) - 1;
            frame.current =
                Math.abs(velocity) > 0.02 && !atEnd ? requestAnimationFrame(tick) : null;
        };
        if (Math.abs(velocity) > 0.05) frame.current = requestAnimationFrame(tick);
    };

    const onClickCapture = (e: React.MouseEvent) => {
        if (!swallowClick.current) return;
        swallowClick.current = false;
        e.preventDefault();
        e.stopPropagation();
    };

    const fade = `linear-gradient(to right, transparent, #000 ${FADE}, #000 calc(100% - ${FADE}), transparent)`;

    return (
        <div
            ref={scrollerRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onClickCapture={onClickCapture}
            onDragStart={(e) => e.preventDefault()}
            className={`relative overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
                overflowing ? (dragging ? 'cursor-grabbing select-none' : 'cursor-grab') : ''
            }`}
            style={
                overflowing
                    ? { maskImage: fade, WebkitMaskImage: fade, paddingInline: FADE }
                    : undefined
            }
        >
            {/* A centred row while it fits; it scrolls from the start once it doesn't. */}
            <ul ref={listRef} className="mx-auto flex w-max gap-2">
                {choices.map((choice) => {
                    const selected = choice.id === selectedId;
                    return (
                        <li
                            key={choice.id}
                            className={choice.apart ? 'flex items-center gap-2' : undefined}
                        >
                            <button
                                type="button"
                                onClick={() => onChoose(choice.id)}
                                aria-pressed={selected}
                                className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition-colors ${
                                    dragging ? 'cursor-grabbing' : ''
                                } ${
                                    selected
                                        ? 'bg-slate-100/10 text-slate-50'
                                        : 'text-slate-400 ring-1 ring-slate-100/15 hover:text-slate-200'
                                }`}
                                style={
                                    selected
                                        ? { boxShadow: `inset 0 0 0 1px ${accent}` }
                                        : undefined
                                }
                            >
                                {choice.label}
                            </button>
                            {choice.apart && (
                                <span aria-hidden="true" className="h-4 w-px bg-slate-100/20" />
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default ScorePicker;
