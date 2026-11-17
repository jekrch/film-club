import React from 'react';

interface StoryProgressProps {
    count: number;
    index: number;
    /** Milliseconds the current slide runs for when advancing on its own; null when it isn't. */
    runMs: number | null;
    paused: boolean;
    /** Changes whenever the slide's clock restarts, so the fill starts over. */
    restartKey?: number;
    accent: string;
    /** Jumps to a slide. */
    onSelect: (index: number) => void;
}

/**
 * The segmented bar along the top: one segment per slide, filled behind the
 * current one. While the deck advances on its own the current segment fills over
 * the slide's run; otherwise it shows full. Each segment is also a way to its
 * slide: the bar is thin, but each segment's hit area runs the bar's full
 * height of padding.
 */
const StoryProgress: React.FC<StoryProgressProps> = ({
    count,
    index,
    runMs,
    paused,
    restartKey,
    accent,
    onSelect,
}) => (
    // The segments butt up against each other, with the visual gap made of each
    // button's side padding, so sweeping the cursor along the bar never falls
    // into a dead gap and drops the hover. The hover grow is a scale rather than
    // a height change: no relayout, no fractional-pixel redraw of the caps.
    <nav className="-mx-0.5 flex" aria-label="Slides">
        {Array.from({ length: count }, (_, i) => (
            <button
                key={i}
                type="button"
                onClick={() => onSelect(i)}
                className="group flex-1 px-0.5 py-[9px]"
                aria-label={`Slide ${i + 1} of ${count}`}
                aria-current={i === index ? 'step' : undefined}
            >
                <span className="block h-[5px] scale-y-[0.6] overflow-hidden rounded-full bg-slate-100/20 transition-[scale,background-color] duration-150 group-hover:scale-y-100 group-hover:bg-slate-100/35">
                    {i < index && (
                        <span className="block h-full w-full" style={{ backgroundColor: accent }} />
                    )}
                    {i === index && (
                        <span
                            // Keyed on the run so a restarted timer restarts the fill.
                            key={`${index}-${runMs}-${restartKey}`}
                            className="block h-full w-full origin-left"
                            style={{
                                backgroundColor: accent,
                                animation: runMs
                                    ? `retro-progress ${runMs}ms linear forwards`
                                    : undefined,
                                animationPlayState: paused ? 'paused' : 'running',
                            }}
                        />
                    )}
                </span>
            </button>
        ))}
    </nav>
);

export default StoryProgress;
