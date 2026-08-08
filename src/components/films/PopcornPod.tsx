import React from 'react';

/**
 * "Hollywood Popcorn Pod" branding for films the club watched outside its usual
 * remit — i.e. a trip to an actual multiplex rather than a Criterion Channel
 * selection (see `Film.popcornPod`).
 *
 * These entries still belong in the log — we did watch them — but they are not
 * selections and have no Criterion page to link to. The point is made entirely
 * through presentation rather than prose: the poster is drained of its dignity
 * and defaced with a buttery ribbon.
 */

/**
 * Poster treatment for a popcorn-pod film: desaturated and pushed toward a stale
 * concession-stand yellow, so the artwork reads as cheaper than its neighbours
 * on the films grid without becoming illegible.
 */
export const POPCORN_POD_POSTER_FILTER = 'saturate-[0.45] sepia-[0.35] contrast-[0.95] brightness-[0.9]';

/**
 * Folded-under tails at each end of a ribbon band. The wedge is thickest at the
 * outer end and tapers inward, so the ribbon reads as passing around the poster
 * rather than lying flat on top of it. Whatever clips the band — the poster's
 * overflow here, the card's corner elsewhere — hides where the tails run off.
 *
 * Shared with the "Up Next" corner ribbon on the films grid so both ribbons are
 * folded the same way.
 */
export const RIBBON_FOLD_CLIP_LEFT = 'polygon(0 0, 100% 0, 0 100%)';
export const RIBBON_FOLD_CLIP_RIGHT = 'polygon(0 0, 100% 0, 100% 100%)';

/**
 * The prose counterpart to the stamp, for the detail page — where there's room
 * to say plainly what the poster treatment only implies. Sits directly under the
 * tagline so it's read before any of the film's credentials are.
 */
export const PopcornPodDisclaimer: React.FC = () => (
    <div className="mb-4 rounded-md border-l-4 border-amber-500/80 bg-amber-500/10 px-4 py-3">
        <p className="text-sm leading-relaxed text-amber-100/90">
            <span className="font-bold uppercase tracking-wide text-amber-300">Disclaimer:</span>{' '}
            this film is <em>not</em> criterion and we did not <em>select</em> it.
            We happened to all see it in theaters, did a pod, and scored it out of 9.
        </p>
    </div>
);

/**
 * A ribbon tied diagonally around the poster, with a tub of popcorn popping out
 * from behind it. Deliberately obtrusive — it is meant to be read before the
 * artwork is, and to make clear at a glance that this was not a selection.
 *
 * Every dimension is expressed against the poster's own width (`cqw`, via the
 * inline-size container on the root, or plain percentages), so the stamp holds
 * exactly the same proportions on a compact grid card and on the detail page.
 * Nothing here is sized in px, and nothing depends on the viewport: an element
 * that looks right at 200px looks the same at 600px.
 */
export const PopcornPodStamp: React.FC = () => (
    <div
        className="@container absolute inset-0 z-20 flex items-center justify-center overflow-hidden pointer-events-none"
        title="A Hollywood Popcorn Pod presentation — not a Criterion Channel selection"
    >
        {/* Band + tails, raked at the same sort of angle as the "Up Next" corner
            ribbon and sitting just above the poster's midline, which leaves room
            for the popcorn above it. Wider than the poster so both ends run off
            the edges, leaving the folds half-visible at the sides.

            Swells on hover like that ribbon does, taking the popcorn and tails
            with it. Only `scale` is transitioned — Tailwind v4 keeps rotate and
            translate as separate properties, so animating `transform` wholesale
            would fight them. Requires a `group` on the poster container, which
            both the card and the detail page provide. */}
        <div className="
            absolute top-[38%] -translate-y-1/2 w-[140%] -rotate-[36deg]
            transition-[scale] duration-300 ease-out group-hover:scale-105
        ">
            {/* The same tub used by the club's rating popcorn, set left of centre
                along the band rather than dead-centre on the poster. The box is
                clipped flush to the band's top edge. */}
            <div className="absolute bottom-full left-[30%] -translate-x-1/2 w-[45cqw] aspect-square overflow-hidden">
                {/* Pushed down past the clip line so its base is cut off: the tub
                    reads as popping out from behind the ribbon rather than standing
                    on it, and the buried part is never drawn, so it can't ghost
                    through the translucent band. Only partly counter-rotated
                    against the band, so it keeps a lean of its own. */}
                <img
                    src="/popcorn.svg"
                    alt=""
                    aria-hidden="true"
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[24%] w-[72%] h-auto origin-bottom rotate-[26deg] opacity-60 drop-shadow-[0_0.6cqw_1.6cqw_rgba(0,0,0,0.6)]"
                />
            </div>

            {/* Left tail, tucked under the band's leading end. */}
            <div
                className="absolute top-full left-0 w-[14%] h-[2cqw] bg-amber-600/80"
                style={{ clipPath: RIBBON_FOLD_CLIP_LEFT }}
            />
            {/* Right tail. */}
            <div
                className="absolute top-full right-0 w-[14%] h-[2cqw] bg-amber-600/80"
                style={{ clipPath: RIBBON_FOLD_CLIP_RIGHT }}
            />

            {/* Semi-transparent so the poster underneath still reads through the
                ribbon; the blur keeps the lettering legible over busy art. Padding
                is in `em`, so the band's depth tracks the lettering. */}
            <div className="
                relative text-center whitespace-nowrap leading-none
                text-[9cqw] tracking-[0.06em] py-[0.3em]
                font-black uppercase text-white
                [text-shadow:0_0.04em_0.1em_rgba(69,26,3,0.85)]
                bg-gradient-to-r from-amber-600/80 via-amber-500/80 to-amber-600/80
                backdrop-blur-[2px]
                border-y border-amber-900/40 shadow-lg shadow-black/60
            ">
                Popcorn Pod
            </div>
        </div>
    </div>
);
