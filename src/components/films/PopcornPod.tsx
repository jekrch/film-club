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
 * A ribbon folded around the poster's top-left corner — the "Up Next" sash in
 * concession amber rather than the club's emerald: same -45deg rake, same
 * tucked-under tails, same swell on hover. Sitting on the corner rather than
 * across the middle leaves the artwork readable while still being the first
 * thing the eye lands on.
 *
 * Every dimension is expressed against the poster's own width (`cqw`, via the
 * inline-size container on the root, or plain percentages), so the stamp holds
 * exactly the same proportions on a compact grid card and on the detail page.
 * Nothing here is sized in px, and nothing depends on the viewport: an element
 * that looks right at 200px looks the same at 600px. (The "Up Next" ribbon
 * solves the same problem with `em` against a per-card font size; it can't use
 * `cqw` because it hangs outside the poster's container.)
 *
 * The geometry is symmetric about the corner's diagonal: the band's centre sits
 * ~23cqw along both axes, so the visible stretch of band between the top and
 * left edges is 23*2*sqrt(2) ~ 65cqw — comfortably longer than the lettering at
 * 6.5cqw. The band itself is far wider than that, so both ends and their tails
 * run off the poster, where the root's overflow clips them flush. Scaling the
 * ribbon means moving the centre out in step with the type, or the lettering
 * outgrows the chord and runs off the poster's edges.
 */
export const PopcornPodStamp: React.FC = () => (
    <div
        className="@container absolute inset-0 z-20 overflow-hidden pointer-events-none"
        title="A Hollywood Popcorn Pod presentation — not a Criterion Channel selection"
    >
        {/* Band + tails. Only `scale` is transitioned — Tailwind v4 keeps rotate
            as a separate property, so animating `transform` wholesale would fight
            the -45deg rake. Requires a `group` on the poster container, which both
            the card and the detail page provide. */}
        <div className="
            absolute w-[90cqw] left-[-22cqw] top-[17.8cqw] -rotate-45
            transition-[scale] duration-300 ease-out group-hover:scale-105
        ">
            {/* Tails, tucked under each end of the band and running off past the
                poster's edges — only the tapering inner tip of each stays visible,
                so the ribbon reads as folding around the corner rather than being
                painted on it. */}
            <div
                className="absolute top-full left-0 w-[34%] h-[4.7cqw] bg-amber-700/80"
                style={{ clipPath: RIBBON_FOLD_CLIP_LEFT }}
            />
            <div
                className="absolute top-full right-0 w-[34%] h-[4.7cqw] bg-amber-700/80"
                style={{ clipPath: RIBBON_FOLD_CLIP_RIGHT }}
            />

            {/* Semi-transparent so the poster underneath still reads through the
                ribbon; the blur keeps the lettering legible over busy art. Padding
                is in `em`, so the band's depth tracks the lettering. */}
            <div className="
                relative text-center whitespace-nowrap leading-none
                text-[6.5cqw] tracking-[0.06em] py-[0.3em]
                font-black uppercase text-white
                [text-shadow:0_0.04em_0.1em_rgba(69,26,3,0.85)]
                bg-gradient-to-r from-amber-600/80 via-amber-500/80 to-amber-600/80
                backdrop-blur-[2px]
                border-y border-amber-900/40 shadow-lg shadow-black/60
                transition-all duration-300 ease-out
                group-hover:from-amber-500/85 group-hover:via-amber-400/85 group-hover:to-amber-500/85
                group-hover:shadow-xl
            ">
                Popcorn Pod
            </div>
        </div>
    </div>
);
