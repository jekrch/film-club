import React, { useMemo, useState } from 'react';
import { EyeIcon, FilmIcon, QueueListIcon } from '@heroicons/react/24/outline';

import PageLayout from '../components/layout/PageLayout';
import CorinthianPillar from '../components/layout/CorinthianPillar';
import HeroBanner from '../components/common/HeroBanner';
import AccentCard from '../components/common/AccentCard';
import Button from '../components/common/Button';
import WallEventRow from '../components/wall/WallEventRow';
import { KIND_ACCENT } from '../components/wall/wallAccents';
import type { IconComponent } from '../components/common/trophyIcons';
import { entryFrameSource, filmFrameSource, type FrameSource } from '../utils/frameSources';
import { useMediaQuery } from '../hooks/useMediaQuery';
import {
    buildWall,
    groupByMonth,
    mergeTrophyRows,
    wallKinds,
    type WallEvent,
    type WallEventKind,
} from '../utils/wallUtils';

/**
 * The club's wall: everything the club and its members have done, newest first.
 *
 * The rest of the site is organized by *thing* — a film's page, a member's log,
 * a list, a trophy shelf. This is the one page organized by *when*, and it is
 * the only place the four show up side by side. It reads and writes nothing:
 * every row is a view onto a record that already exists somewhere else, and
 * every row links back to where that record lives.
 *
 * Public and identical for everyone. It is built from bundled data alone (see
 * the note atop `utils/wallUtils.ts`), so a signed-out visitor gets the whole
 * wall with no round trip and a signed-in member gets exactly the same one.
 */

/**
 * The pillar down the wall's left side: full strength behind the banner, dimmer
 * over the events, and gone by the bottom of the card — the home page's trail,
 * shortened to a page whose content starts right under its banner.
 */
const PILLAR_TRAIL_MASK =
    'linear-gradient(to bottom, rgba(0,0,0,1) 0px, rgba(0,0,0,1) 200px, rgba(0,0,0,0.55) 380px, rgba(0,0,0,0.45) 92%, rgba(0,0,0,0) 100%)';

/**
 * Lower than the home page's colonnade, which stands in empty margins. This one
 * runs under the timeline — its nodes, its rail, its dates — and anything
 * stronger competes with them instead of standing behind them.
 */
const PILLAR_OPACITY = 0.1;

/**
 * Where the pillar stands, in pixels from the left edge of the page container.
 *
 * The shaft is centered in the SVG's box, so seating it under the timeline nodes
 * is a matter of centering that box on them: a node sits at the card's left
 * padding edge (`p-3 sm:p-6 md:p-8`) and reaches half its own width (`h-8
 * sm:h-9`) past it. The widths are picked so the shaft — 22 of the drawing's 50
 * units — comes out about as wide as a node, which is what makes the icons read
 * as hanging on the column rather than beside it. All pixel facts the SVG needs
 * as numbers, which is why this is a media query rather than responsive classes.
 */
const usePillarPlacement = (): { width: number; left: number } => {
    const isMd = useMediaQuery('(min-width: 768px)');
    const isSm = useMediaQuery('(min-width: 640px)');
    const width = isSm ? 80 : 64;
    const nodeCenter = isMd ? 32 + 18 : isSm ? 24 + 18 : 12 + 16;
    return { width, left: nodeCenter - width / 2 };
};

/** How many rows a page of the wall shows, and how many more "Show more" adds. */
const PAGE_SIZE = 40;

/** Art for the banner collage, taken from the most recent events that have any. */
const COLLAGE_SIZE = 12;

/**
 * The filter chips, in the order they read.
 *
 * Trophies get no chip of their own: they are handed out at a screening and
 * fold into its row, so narrowing to them would ask for a slice of the wall
 * that mostly isn't drawn on its own.
 */
const FILTERS: { kind: WallEventKind; label: string; Icon: IconComponent }[] = [
    { kind: 'club-watch', label: 'Screenings', Icon: FilmIcon as IconComponent },
    { kind: 'log', label: 'Logs', Icon: EyeIcon as IconComponent },
    { kind: 'list', label: 'Lists', Icon: QueueListIcon as IconComponent },
];

/**
 * The frame source behind one event, for the banner collage.
 *
 * A list has no single film to stand for it, so it contributes nothing here —
 * the collage wants art that means something, and the poster of whatever
 * happens to sit at rank 1 of somebody's list doesn't.
 */
const eventFrameSource = (event: WallEvent): FrameSource | null => {
    switch (event.kind) {
        case 'club-watch':
        case 'trophy':
            return filmFrameSource(event.film);
        case 'log':
            return entryFrameSource(event.entry);
        case 'list':
            return null;
    }
};

const WallPage: React.FC = () => {
    // Built once for the session: it is a pass over four bundled files, and
    // nothing on this page changes any of them.
    const events = useMemo(() => buildWall(), []);

    const { width: pillarWidth, left: pillarLeft } = usePillarPlacement();

    const [kinds, setKinds] = useState<Set<WallEventKind>>(new Set());
    const [visible, setVisible] = useState(PAGE_SIZE);

    /** The kinds this club has actually recorded — no chip for an empty filter. */
    const present = useMemo(() => wallKinds(events), [events]);

    const filtered = useMemo(
        // An empty selection means everything rather than nothing: the chips are
        // a way to narrow the wall, and a wall you have narrowed to nothing is
        // never what anyone was reaching for.
        () => (kinds.size === 0 ? events : events.filter((event) => kinds.has(event.kind))),
        [events, kinds]
    );

    // Paged in events rather than in boxes, so "40 of 112" counts the same
    // things the heading does. The fold happens inside each month, after the
    // cut: a month never splits a same-day run, so folding per month gives the
    // same boxes as folding the whole page would.
    const months = useMemo(
        () =>
            groupByMonth(filtered.slice(0, visible)).map((month) => ({
                ...month,
                rows: mergeTrophyRows(month.events),
            })),
        [filtered, visible]
    );
    const shown = Math.min(visible, filtered.length);

    // Drawn from the newest events rather than the whole history, so the banner
    // shows what the club has been watching lately instead of a decade's
    // average. Deduped by film: a screening and the trophies given at it are
    // three events about one piece of artwork.
    const collage = useMemo(() => {
        const sources = new Map<string, FrameSource>();
        for (const event of events) {
            if (sources.size >= COLLAGE_SIZE) break;
            const source = eventFrameSource(event);
            if (source && source.images.length > 0 && !sources.has(source.imdbID)) {
                sources.set(source.imdbID, source);
            }
        }
        return [...sources.values()];
    }, [events]);

    const toggle = (kind: WallEventKind) => {
        setKinds((current) => {
            const next = new Set(current);
            if (!next.delete(kind)) next.add(kind);
            return next;
        });
        // A narrower wall starts at the top of its own first page rather than
        // forty rows deep into a set the reader has just replaced.
        setVisible(PAGE_SIZE);
    };

    return (
        <PageLayout>
            {/* One pillar, dropping out of the banner's left edge and running the
                length of the wall behind the timeline — which is why the page
                takes itself out of the site-wide backdrop in `App.tsx`. It is
                seated on the column of nodes rather than in the margin: the
                icons, the rail between them and the dates beside them all sit
                over the shaft, so the timeline reads as hung on the column. */}
            <div className="relative">
                <div
                    className="pointer-events-none absolute inset-y-0 -z-10"
                    style={{
                        left: `${pillarLeft}px`,
                        width: `${pillarWidth}px`,
                        maskImage: PILLAR_TRAIL_MASK,
                        WebkitMaskImage: PILLAR_TRAIL_MASK,
                    }}
                    aria-hidden="true"
                >
                    {/* `!left-0`: the pillar's own inset steps in at `sm` and
                        `lg`, and the placement above has already put the box
                        exactly where it belongs. */}
                    <CorinthianPillar
                        side="left"
                        flipped
                        width={pillarWidth}
                        opacity={PILLAR_OPACITY}
                        className="!left-0"
                    />
                </div>

                <HeroBanner sources={collage} className="mb-8">
                    <h1 className="text-2xl font-thin text-slate-100 sm:text-3xl">
                        What we've been up to
                    </h1>
                </HeroBanner>

                <AccentCard accent="blue" className="mb-12 p-3 sm:p-6 md:p-8">
                    <div className="mb-6 flex flex-wrap items-center gap-3">
                        <h4 className="text-xl font-bold text-slate-100">
                            {filtered.length} Event{filtered.length !== 1 ? 's' : ''}
                        </h4>
                        <span className="h-px flex-grow bg-gradient-to-r from-blue-400/25 via-slate-700/60 to-transparent" />
                        <div className="flex flex-wrap gap-1.5">
                            {FILTERS.filter((filter) => present.has(filter.kind)).map(
                                ({ kind, label, Icon }) => (
                                    <Button
                                        key={kind}
                                        variant="chip"
                                        size="xs"
                                        accent={KIND_ACCENT[kind]}
                                        active={kinds.has(kind)}
                                        aria-pressed={kinds.has(kind)}
                                        onClick={() => toggle(kind)}
                                    >
                                        <Icon className="h-3.5 w-3.5" />
                                        {label}
                                    </Button>
                                )
                            )}
                        </div>
                    </div>

                    {months.length === 0 ? (
                        <p className="py-6 text-center italic text-slate-400">
                            Nothing here yet. Watch something.
                        </p>
                    ) : (
                        <div className="space-y-8">
                            {months.map((month, monthIndex) => (
                                <section key={month.key}>
                                    <div className="mb-4 flex items-center gap-3">
                                        <h5 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                                            {month.label}
                                        </h5>
                                        <span className="h-px flex-grow bg-gradient-to-r from-slate-700/70 to-transparent" />
                                        <span className="text-xs tabular-nums text-slate-600">
                                            {month.events.length}
                                        </span>
                                    </div>

                                    <ol className="space-y-2">
                                        {month.rows.map((row, index) => (
                                            <WallEventRow
                                                key={row.id}
                                                row={row}
                                                // The rail stops at the wall's last
                                                // visible row, but crosses a month
                                                // boundary — the months are headings
                                                // over one timeline, not four.
                                                connected={
                                                    monthIndex < months.length - 1 ||
                                                    index < month.rows.length - 1
                                                }
                                            />
                                        ))}
                                    </ol>
                                </section>
                            ))}
                        </div>
                    )}

                    {shown < filtered.length && (
                        <div className="mt-8 flex flex-col items-center gap-2">
                            <Button
                                variant="solid"
                                size="sm"
                                onClick={() => setVisible((count) => count + PAGE_SIZE)}
                            >
                                Show more
                            </Button>
                            <span className="text-xs uppercase tracking-widest text-slate-600">
                                {shown} of {filtered.length}
                            </span>
                        </div>
                    )}
                </AccentCard>
            </div>
        </PageLayout>
    );
};

export default WallPage;
