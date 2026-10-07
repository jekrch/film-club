import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import classNames from 'classnames';
import {
    ReactFlow,
    Node,
    Edge,
    EdgeProps,
    Background,
    BackgroundVariant,
    BaseEdge,
    EdgeLabelRenderer,
    Panel,
    getBezierPath,
    useReactFlow,
    useStore,
    ReactFlowState,
    useNodesState,
    useEdgesState,
    Position,
    Handle,
    NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import { Link } from 'react-router-dom';
import {
    ArrowsPointingOutIcon,
    FilmIcon,
    MinusIcon,
    PlusIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { Film } from '../../types/film';
import ChartContainer from './ChartContainer';
import Button from '../common/Button';
import { ACCENT_RAIL } from '../common/accents';
import CreditsModal from '../common/CreditsModal';
import { getAllFilmCreditsForPerson, PersonCredit } from '../../utils/filmUtils';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SharedCredit {
    name: string;
    roles: string[]; // roles shared across both films
}

interface FilmEdgeData {
    sharedCredits: SharedCredit[];
    weight: number;
    /** `weight` over the heaviest tie in the graph, 0–1. Drives stroke weight. */
    normalised: number;
    [key: string]: unknown;
}

interface FilmNodeData {
    film: Film;
    connectionCount: number;
    maxConnections: number;
    [key: string]: unknown;
}

interface ConnectionDetail {
    filmA: Film;
    filmB: Film;
    sharedCredits: SharedCredit[];
}

// ─── Credit extraction ──────────────────────────────────────────────────────

const CREDIT_FIELDS: { field: keyof Film; role: string }[] = [
    { field: 'director', role: 'Director' },
    { field: 'writer', role: 'Writer' },
    { field: 'actors', role: 'Actor' },
    { field: 'cinematographer', role: 'Cinematographer' },
    { field: 'editor', role: 'Editor' },
    { field: 'productionDesigner', role: 'Production Designer' },
    { field: 'musicComposer', role: 'Composer' },
    { field: 'costumeDesigner', role: 'Costume Designer' },
];

function extractCredits(film: Film): Map<string, Set<string>> {
    const credits = new Map<string, Set<string>>();
    const addCredit = (name: string, role: string) => {
        if (!name) return;
        if (!credits.has(name)) credits.set(name, new Set());
        credits.get(name)!.add(role);
    };

    for (const { field, role } of CREDIT_FIELDS) {
        const value = film[field] as string | undefined;
        if (!value || typeof value !== 'string' || value.toLowerCase() === 'n/a') continue;
        value.split(',').forEach((raw) => addCredit(raw.trim(), role));
    }

    // Include the extended TMDb cast so connections aren't limited to the
    // shorter "Stars" string — anyone billed in both films links them.
    film.cast?.forEach((member) => addCredit(member?.name?.trim() ?? '', 'Actor'));

    return credits;
}

function computeSharedCredits(filmA: Film, filmB: Film): SharedCredit[] {
    const creditsA = extractCredits(filmA);
    const creditsB = extractCredits(filmB);
    const shared: SharedCredit[] = [];

    for (const [name, rolesA] of creditsA) {
        if (creditsB.has(name)) {
            const rolesB = creditsB.get(name)!;
            const allRoles = new Set([...rolesA, ...rolesB]);
            shared.push({ name, roles: Array.from(allRoles) });
        }
    }
    return shared;
}

// ─── Layout ─────────────────────────────────────────────────────────────────

const NODE_WIDTH = 160;
const NODE_HEIGHT = 240;

const GAP = 90; // spacing between nodes within a rank
const RANK_SEP = 180; // vertical run between ranks — the length of most ties
const COMPONENT_GAP = 120; // breathing room between separately packed groups

/** Width:height to pack toward before the canvas has been measured. */
const DEFAULT_ASPECT = 2;

interface LaidComponent {
    // Node centre positions, normalised so the component's top-left box corner is (0,0).
    centres: Map<string, { x: number; y: number }>;
    width: number;
    height: number;
}

/**
 * Splits the graph into connected components (sets of films reachable from one
 * another through shared credits). Disconnected groups are laid out and packed
 * separately, so two unrelated chains can never interleave and cross.
 */
function connectedComponents(nodeIds: string[], edges: Edge[]): string[][] {
    const adj = new Map<string, string[]>();
    nodeIds.forEach((id) => adj.set(id, []));
    edges.forEach((e) => {
        adj.get(e.source)?.push(e.target);
        adj.get(e.target)?.push(e.source);
    });

    const visited = new Set<string>();
    const components: string[][] = [];
    nodeIds.forEach((start) => {
        if (visited.has(start)) return;
        const comp: string[] = [];
        const stack = [start];
        visited.add(start);
        while (stack.length) {
            const id = stack.pop()!;
            comp.push(id);
            (adj.get(id) ?? []).forEach((nb) => {
                if (!visited.has(nb)) {
                    visited.add(nb);
                    stack.push(nb);
                }
            });
        }
        components.push(comp);
    });
    return components;
}

/**
 * Nudges single-connection ("leaf") films so they sit directly above/below their
 * one neighbour, turning a long diagonal edge into a straight vertical one. A
 * leaf has no other edges, so moving it horizontally within its own rank cannot
 * introduce any new crossing — we only skip the move when another node already
 * occupies that slot, so nodes never overlap.
 */
function alignLeafNodes(
    g: InstanceType<typeof dagre.graphlib.Graph>,
    nodeIds: string[],
    edges: Edge[]
): void {
    // dagre's node labels are loosely typed; after layout they carry x/y.
    const pos = (id: string) => g.node(id) as { x: number; y: number };

    const degree = new Map<string, number>();
    const neighbour = new Map<string, string>();
    edges.forEach((e) => {
        degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
        degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
        neighbour.set(e.source, e.target);
        neighbour.set(e.target, e.source);
    });

    // Group nodes by rank (shared y) so we can check for an occupied slot.
    const rankOf = (id: string) => Math.round(pos(id).y);
    const byRank = new Map<number, string[]>();
    nodeIds.forEach((id) => {
        const r = rankOf(id);
        (byRank.get(r) ?? byRank.set(r, []).get(r)!).push(id);
    });

    const minGap = NODE_WIDTH + 40; // keep clear of any neighbour in the rank

    nodeIds.forEach((id) => {
        if (degree.get(id) !== 1) return;
        const nb = neighbour.get(id);
        if (!nb) return;
        const desiredX = pos(nb).x;
        const peers = byRank.get(rankOf(id)) ?? [];
        const blocked = peers.some(
            (other) => other !== id && Math.abs(pos(other).x - desiredX) < minGap
        );
        if (!blocked) pos(id).x = desiredX;
    });
}

/** Runs dagre on a single connected component and returns normalised centres + size. */
function layoutComponent(nodeIds: string[], edges: Edge[]): LaidComponent {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'TB', nodesep: GAP, ranksep: RANK_SEP, marginx: 0, marginy: 0 });

    const idSet = new Set(nodeIds);
    nodeIds.forEach((id) => g.setNode(id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
    const internalEdges = edges.filter((e) => idSet.has(e.source) && idSet.has(e.target));
    internalEdges.forEach((e) => g.setEdge(e.source, e.target));

    dagre.layout(g);
    alignLeafNodes(g, nodeIds, internalEdges);

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    nodeIds.forEach((id) => {
        const p = g.node(id) as { x: number; y: number };
        minX = Math.min(minX, p.x - NODE_WIDTH / 2);
        maxX = Math.max(maxX, p.x + NODE_WIDTH / 2);
        minY = Math.min(minY, p.y - NODE_HEIGHT / 2);
        maxY = Math.max(maxY, p.y + NODE_HEIGHT / 2);
    });

    const centres = new Map<string, { x: number; y: number }>();
    nodeIds.forEach((id) => {
        const p = g.node(id) as { x: number; y: number };
        centres.set(id, { x: p.x - minX, y: p.y - minY });
    });

    return { centres, width: maxX - minX, height: maxY - minY };
}

/**
 * Lays out the whole graph: each connected component is positioned independently
 * (so disconnected chains stay in their own lane and never cross), then the
 * components are shelf-packed left-to-right, wrapping onto a new row once the
 * overall bound reaches the canvas's own proportions — so fit-to-view fills the
 * space instead of leaving a band empty above and below, or to the sides.
 *
 * Within a shelf each group is centred vertically, and each shelf is centred
 * horizontally, so short groups and short rows don't all pile up top-left.
 */
function applyDagreLayout(
    nodes: Node<FilmNodeData>[],
    edges: Edge[],
    aspect: number
): Node<FilmNodeData>[] {
    const components = connectedComponents(
        nodes.map((n) => n.id),
        edges
    )
        .map((ids) => layoutComponent(ids, edges))
        // Tallest first packs into tidier shelves.
        .sort((a, b) => b.height - a.height);

    const totalArea = components.reduce(
        (sum, c) => sum + (c.width + COMPONENT_GAP) * (c.height + COMPONENT_GAP),
        0
    );
    const targetWidth = Math.max(Math.sqrt(totalArea * aspect), ...components.map((c) => c.width));

    // First pass: decide which shelf each component sits on.
    const shelves: { items: LaidComponent[]; width: number; height: number }[] = [];
    components.forEach((c) => {
        const shelf = shelves[shelves.length - 1];
        if (!shelf || shelf.width + COMPONENT_GAP + c.width > targetWidth) {
            shelves.push({ items: [c], width: c.width, height: c.height });
        } else {
            shelf.items.push(c);
            shelf.width += COMPONENT_GAP + c.width;
            shelf.height = Math.max(shelf.height, c.height);
        }
    });

    // Second pass: place them, centred within their shelf and the overall width.
    const layoutWidth = Math.max(...shelves.map((sh) => sh.width));
    const centreById = new Map<string, { x: number; y: number }>();
    let shelfY = 0;
    shelves.forEach((shelf) => {
        let x = (layoutWidth - shelf.width) / 2;
        shelf.items.forEach((c) => {
            const y = shelfY + (shelf.height - c.height) / 2;
            c.centres.forEach((p, id) => {
                centreById.set(id, { x: x + p.x, y: y + p.y });
            });
            x += c.width + COMPONENT_GAP;
        });
        shelfY += shelf.height + COMPONENT_GAP;
    });

    return nodes.map((node) => {
        const centre = centreById.get(node.id) ?? { x: 0, y: 0 };
        return {
            ...node,
            position: {
                x: centre.x - NODE_WIDTH / 2,
                y: centre.y - NODE_HEIGHT / 2,
            },
        };
    });
}

// ─── Focus ──────────────────────────────────────────────────────────────────

/**
 * What the graph is currently looking at. Tapping a film lights it, its ties
 * and its neighbours; selecting a line lights that pair. Everything else
 * recedes. While nothing is selected, hovering a film previews the same thing.
 * `null` sets mean nothing is in focus and the whole graph reads at rest.
 *
 * Shared through context rather than written into node/edge data so a hover
 * doesn't rebuild the node array React Flow is tracking.
 */
interface GraphFocus {
    focusedId: string | null;
    selectedEdgeId: string | null;
    /** The line under the pointer; lit on its own, without dimming the rest. */
    hoveredEdgeId: string | null;
    litNodeIds: Set<string> | null;
    litEdgeIds: Set<string> | null;
    selectEdge: (id: string) => void;
    hoverEdge: (id: string | null) => void;
}

const GraphFocusContext = createContext<GraphFocus>({
    focusedId: null,
    selectedEdgeId: null,
    hoveredEdgeId: null,
    litNodeIds: null,
    litEdgeIds: null,
    selectEdge: () => {},
    hoverEdge: () => {},
});

// ─── Custom Film Node ───────────────────────────────────────────────────────

/** Share of the busiest film's ties at which a film counts as a hub. */
const HUB_THRESHOLD = 0.5;

function FilmNode({ id, data }: NodeProps<Node<FilmNodeData>>) {
    const { film, connectionCount, maxConnections } = data;
    const { focusedId, litNodeIds } = useContext(GraphFocusContext);

    const lit = litNodeIds?.has(id) ?? false;
    const dimmed = litNodeIds !== null && !lit;
    const isHub = maxConnections > 0 && connectionCount / maxConnections >= HUB_THRESHOLD;
    const posterUrl = film.poster && film.poster !== 'N/A' ? film.poster : undefined;

    return (
        // A poster, set the way the film cards set one: full bleed, a scrim at
        // the foot, and the title in serif over it.
        <div
            className={classNames(
                'relative cursor-pointer overflow-hidden rounded-lg bg-slate-800 shadow-lg shadow-black/40 ring-1',
                'transition-[opacity,filter,box-shadow] duration-200',
                focusedId === id
                    ? 'ring-2 ring-blue-300/60'
                    : lit
                      ? 'ring-blue-300/40'
                      : 'ring-white/10 hover:ring-white/30',
                dimmed && 'opacity-30 saturate-50 hover:opacity-60'
            )}
            style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
        >
            <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
            <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />

            {posterUrl ? (
                <img
                    src={posterUrl}
                    alt=""
                    draggable={false}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover"
                />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-700/40">
                    <FilmIcon className="h-8 w-8 text-slate-500" />
                </div>
            )}

            <div
                className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-slate-950 via-slate-950/75 to-transparent"
                aria-hidden="true"
            />
            <div className="absolute inset-x-0 bottom-0 px-2.5 pb-2.5">
                <div
                    className="line-clamp-2 font-serif text-[13px] leading-snug text-slate-100"
                    title={film.title}
                >
                    {film.title}
                </div>
                {/* Year, then shared credits across all of this film's ties.
                    Hubs take the accent so the busiest films stand out. */}
                <div className="mt-1 flex items-baseline justify-between gap-2">
                    <span className="font-serif text-[11px] tabular-nums text-slate-400">
                        {film.year}
                    </span>
                    {connectionCount > 0 && (
                        <span
                            className={classNames(
                                'text-[9px] font-medium uppercase tracking-[0.14em]',
                                isHub ? 'text-blue-300/90' : 'text-slate-500'
                            )}
                        >
                            <span
                                className={classNames(
                                    'mr-0.5 font-serif text-[11px] normal-case tracking-normal tabular-nums',
                                    isHub ? 'text-blue-200' : 'text-slate-300'
                                )}
                            >
                                {connectionCount}
                            </span>
                            shared
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

const nodeTypes = { filmNode: FilmNode };

// ─── Custom Connection Edge ─────────────────────────────────────────────────

/**
 * How much to counter-scale a line's stroke and label against the canvas zoom.
 * Fit-to-view usually zooms well out, which shrank the ties to hairlines and
 * their labels to specks; this keeps them a readable, clickable size on screen.
 * Never below 1, so zooming in doesn't shrink them either.
 */
const MAX_COUNTER_SCALE = 1.8;

/** Zoom, rounded so edges re-render in steps rather than on every wheel tick. */
const zoomSelector = (s: ReactFlowState) => Math.round(s.transform[2] * 20) / 20;

/**
 * An undirected tie: no arrowhead, since sharing a credit runs both ways.
 * Stroke weight and opacity rise with the number of shared credits; the count
 * itself sits on the line as a badge that also opens the pair's details.
 */
function ConnectionEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
}: EdgeProps<Edge<FilmEdgeData>>) {
    const { litEdgeIds, selectedEdgeId, hoveredEdgeId, selectEdge, hoverEdge } =
        useContext(GraphFocusContext);
    const zoom = useStore(zoomSelector);
    const [path, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    const scale = Math.min(MAX_COUNTER_SCALE, Math.max(1, 1 / zoom));
    const weight = data?.weight ?? 1;
    const normalised = data?.normalised ?? 0;
    const hovered = hoveredEdgeId === id;
    const selected = selectedEdgeId === id;
    const lit = hovered || (litEdgeIds?.has(id) ?? false);
    const dimmed = litEdgeIds !== null && !lit;

    return (
        <>
            <BaseEdge
                id={id}
                path={path}
                // A generous invisible hit area, so the line itself is easy to
                // catch with a pointer or a finger.
                interactionWidth={48 * scale}
                style={{
                    // Inline because the stroke scales continuously with weight.
                    stroke: lit
                        ? 'rgba(147, 197, 253, 0.85)'
                        : `rgba(148, 163, 184, ${0.35 + normalised * 0.3})`,
                    strokeWidth: (1.25 + normalised * 2 + (selected || hovered ? 0.75 : 0)) * scale,
                    strokeLinecap: 'round',
                    opacity: dimmed ? 0.25 : 1,
                    transition: 'stroke 200ms, stroke-width 200ms, opacity 200ms',
                    cursor: 'pointer',
                }}
            />
            <EdgeLabelRenderer>
                {/* The padding is a transparent hit area around the badge. */}
                <button
                    type="button"
                    onClick={() => selectEdge(id)}
                    onMouseEnter={() => hoverEdge(id)}
                    onMouseLeave={() => hoverEdge(null)}
                    className="nodrag nopan absolute cursor-pointer p-2.5"
                    style={{
                        transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px) scale(${scale})`,
                        pointerEvents: 'all',
                        zIndex: lit ? 1 : undefined,
                    }}
                    aria-label={`${weight} shared credit${weight !== 1 ? 's' : ''} — show who`}
                    title="Show shared credits"
                >
                    <span
                        className={classNames(
                            'flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-900 px-2 font-serif text-xs tabular-nums ring-1',
                            'transition-[opacity,color,box-shadow] duration-200',
                            lit
                                ? 'text-blue-100 ring-blue-300/50'
                                : 'text-slate-400 ring-slate-600/60',
                            dimmed && 'opacity-40'
                        )}
                    >
                        {weight}
                    </span>
                </button>
            </EdgeLabelRenderer>
        </>
    );
}

const edgeTypes = { connection: ConnectionEdge };

// ─── Canvas controls ────────────────────────────────────────────────────────

/** Zoom and fit, as a small toolbar in the app's own surface rather than React Flow's. */
function GraphControls() {
    const { zoomIn, zoomOut, fitView } = useReactFlow();
    const buttonClass =
        'flex h-8 w-8 items-center justify-center text-slate-400 transition-colors hover:bg-slate-700/45 hover:text-slate-100';

    return (
        <Panel
            position="bottom-left"
            className="flex flex-col divide-y divide-slate-700/60 overflow-hidden rounded-lg border border-slate-700/60 bg-slate-900/90 shadow-lg shadow-black/40"
            style={{ margin: 12 }}
        >
            <button
                type="button"
                className={buttonClass}
                onClick={() => zoomIn({ duration: 200 })}
                aria-label="Zoom in"
                title="Zoom in"
            >
                <PlusIcon className="h-4 w-4" />
            </button>
            <button
                type="button"
                className={buttonClass}
                onClick={() => zoomOut({ duration: 200 })}
                aria-label="Zoom out"
                title="Zoom out"
            >
                <MinusIcon className="h-4 w-4" />
            </button>
            <button
                type="button"
                className={buttonClass}
                onClick={() => fitView({ padding: FIT_PADDING, duration: 300 })}
                aria-label="Fit graph to view"
                title="Fit to view"
            >
                <ArrowsPointingOutIcon className="h-4 w-4" />
            </button>
        </Panel>
    );
}

// ─── Edge detail panel ──────────────────────────────────────────────────────

/** One side of the pair: poster thumbnail and title, linking to the film. */
function PairFilm({
    film,
    onNavigate,
    align = 'left',
}: {
    film: Film;
    onNavigate: () => void;
    align?: 'left' | 'right';
}) {
    const posterUrl = film.poster && film.poster !== 'N/A' ? film.poster : undefined;
    return (
        <Link
            to={`/films/${film.imdbID}`}
            onClick={onNavigate}
            className={classNames(
                'group/film flex min-w-0 items-center gap-2.5',
                align === 'right' && 'flex-row-reverse text-right'
            )}
            title={`${film.title} (${film.year})`}
        >
            {posterUrl ? (
                <img
                    src={posterUrl}
                    alt=""
                    className="h-12 w-8 flex-shrink-0 rounded object-cover shadow-sm ring-1 ring-white/10 transition-shadow group-hover/film:ring-blue-300/50"
                />
            ) : (
                <span className="flex h-12 w-8 flex-shrink-0 items-center justify-center rounded bg-slate-700/50">
                    <FilmIcon className="h-4 w-4 text-slate-500" />
                </span>
            )}
            <span className="min-w-0">
                <span className="block truncate font-serif text-sm italic text-slate-100 transition-colors group-hover/film:text-blue-300">
                    {film.title}
                </span>
                <span className="block font-serif text-xs tabular-nums text-slate-500">
                    {film.year}
                </span>
            </span>
        </Link>
    );
}

function ConnectionDetailPanel({
    detail,
    onClose,
    onPersonClick,
}: {
    detail: ConnectionDetail;
    onClose: () => void;
    onPersonClick: (name: string) => void;
}) {
    const count = detail.sharedCredits.length;
    return (
        // Floats over the canvas, so it takes the Modal panel's surface: solid
        // fill, light border, lit top edge and the accent rail.
        <div
            className={classNames(
                'absolute inset-x-3 bottom-3 z-20 flex max-h-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-xl',
                'border border-slate-700/60 bg-slate-900/95 text-slate-200 shadow-2xl shadow-black/60 ring-1 ring-white/[0.06]',
                'animate-fadeIn sm:left-1/2 sm:right-auto sm:w-[26rem] sm:-translate-x-1/2'
            )}
        >
            <span
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
                aria-hidden="true"
            />
            <span
                className={classNames(
                    'pointer-events-none absolute inset-y-0 left-0 w-0.5',
                    ACCENT_RAIL.blue
                )}
                aria-hidden="true"
            />

            <div className="flex items-center gap-2.5 pl-4 pr-2 pt-2.5">
                <h4 className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
                    <span className="mr-1 font-serif text-sm normal-case tracking-normal tabular-nums text-slate-200">
                        {count}
                    </span>
                    shared credit{count !== 1 ? 's' : ''}
                </h4>
                <span className="h-px flex-1 bg-slate-600/40" aria-hidden="true" />
                <Button
                    variant="ghost"
                    size="xs"
                    onClick={onClose}
                    aria-label="Close connection details"
                >
                    <XMarkIcon className="h-4 w-4" />
                </Button>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-slate-700/60 px-4 pb-3 pt-2">
                <PairFilm film={detail.filmA} onNavigate={onClose} />
                <span className="font-serif text-sm italic text-slate-500" aria-hidden="true">
                    &amp;
                </span>
                <PairFilm film={detail.filmB} onNavigate={onClose} align="right" />
            </div>

            <ul className="themed-scrollbar min-h-0 flex-1 divide-y divide-slate-700/40 overflow-y-auto px-4 py-1.5">
                {detail.sharedCredits.map((sc) => (
                    <li key={sc.name} className="flex items-baseline justify-between gap-3 py-1.5">
                        <button
                            type="button"
                            onClick={() => onPersonClick(sc.name)}
                            className="min-w-0 truncate text-left text-sm text-slate-200 transition-colors hover:text-blue-300"
                            title={`View ${sc.name}'s credits`}
                        >
                            {sc.name}
                        </button>
                        <span className="flex-shrink-0 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
                            {sc.roles.join(' · ')}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

// ─── Main component ─────────────────────────────────────────────────────────

const FIT_PADDING = 0.15;

const GRAPH_TITLE = 'Connection Graph';

interface FilmConnectionGraphProps {
    films: Film[];
    className?: string;
    style?: React.CSSProperties;
}

const FilmConnectionGraph: React.FC<FilmConnectionGraphProps> = ({ films, className, style }) => {
    const [selectedEdgeId, setSelectedEdgeId] = React.useState<string | null>(null);
    const [hoveredId, setHoveredId] = React.useState<string | null>(null);
    const [hoveredEdgeId, setHoveredEdgeId] = React.useState<string | null>(null);
    // A clicked film keeps its ties lit after the pointer leaves — the only way
    // to trace them on a touch screen, where there's no hover.
    const [pinnedId, setPinnedId] = React.useState<string | null>(null);
    const [creditsPerson, setCreditsPerson] = React.useState<{
        name: string;
        filmography: PersonCredit[];
    } | null>(null);
    const threshold = 1;

    // Scroll-to-zoom is opt-in: until the user clicks into the canvas the wheel
    // belongs to the page, so scrolling past the graph doesn't get captured.
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [zoomEnabled, setZoomEnabled] = React.useState(false);

    React.useEffect(() => {
        if (!zoomEnabled) return;
        const handlePointerDown = (e: PointerEvent) => {
            if (!containerRef.current?.contains(e.target as globalThis.Node)) setZoomEnabled(false);
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setZoomEnabled(false);
        };
        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [zoomEnabled]);

    // The canvas's proportions, which the layout packs toward. Bucketed so a
    // small resize doesn't re-run the layout (and throw away any dragging).
    const [canvasAspect, setCanvasAspect] = React.useState(DEFAULT_ASPECT);
    const canvasRef = useCallback((el: HTMLDivElement | null) => {
        containerRef.current = el;
        if (!el) return;
        const measure = () => {
            const { width, height } = el.getBoundingClientRect();
            if (width === 0 || height === 0) return;
            setCanvasAspect(Math.min(3, Math.max(0.6, Math.round((width / height) * 4) / 4)));
        };
        measure();
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const handlePersonClick = useCallback(
        (name: string) => {
            setCreditsPerson({ name, filmography: getAllFilmCreditsForPerson(name, films) });
        },
        [films]
    );

    // Compute all pairwise shared credits once
    const pairData = useMemo(() => {
        const pairs: {
            id: string;
            idA: string;
            idB: string;
            filmA: Film;
            filmB: Film;
            shared: SharedCredit[];
        }[] = [];

        for (let i = 0; i < films.length; i++) {
            for (let j = i + 1; j < films.length; j++) {
                const shared = computeSharedCredits(films[i], films[j]);
                if (shared.length > 0) {
                    pairs.push({
                        id: `${films[i].imdbID}-${films[j].imdbID}`,
                        idA: films[i].imdbID,
                        idB: films[j].imdbID,
                        filmA: films[i],
                        filmB: films[j],
                        shared,
                    });
                }
            }
        }
        return pairs;
    }, [films]);

    const pairById = useMemo(() => new Map(pairData.map((p) => [p.id, p])), [pairData]);

    const maxWeight = useMemo(
        () => Math.max(1, ...pairData.map((p) => p.shared.length)),
        [pairData]
    );

    // Build nodes & edges from the filtered pairs
    const { initialNodes, initialEdges } = useMemo(() => {
        const filteredPairs = pairData.filter((p) => p.shared.length >= threshold);

        // Only include films that have at least one visible edge
        const connectedIds = new Set<string>();
        filteredPairs.forEach((p) => {
            connectedIds.add(p.idA);
            connectedIds.add(p.idB);
        });

        // Connection count per film
        const countMap = new Map<string, number>();
        filteredPairs.forEach((p) => {
            countMap.set(p.idA, (countMap.get(p.idA) || 0) + p.shared.length);
            countMap.set(p.idB, (countMap.get(p.idB) || 0) + p.shared.length);
        });
        const maxConn = Math.max(1, ...Array.from(countMap.values()));

        const filmMap = new Map(films.map((f) => [f.imdbID, f]));

        const nodes: Node<FilmNodeData>[] = Array.from(connectedIds).map((id) => ({
            id,
            type: 'filmNode',
            position: { x: 0, y: 0 },
            data: {
                film: filmMap.get(id)!,
                connectionCount: countMap.get(id) || 0,
                maxConnections: maxConn,
            },
        }));

        const edges: Edge<FilmEdgeData>[] = filteredPairs.map((p) => {
            const weight = p.shared.length;
            return {
                id: p.id,
                source: p.idA,
                target: p.idB,
                type: 'connection',
                data: { sharedCredits: p.shared, weight, normalised: weight / maxWeight },
            };
        });

        const laid = applyDagreLayout(nodes, edges, canvasAspect);
        return { initialNodes: laid, initialEdges: edges };
    }, [films, pairData, threshold, maxWeight, canvasAspect]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    // Adopt a fresh layout in the same render that computes it, so React Flow
    // never mounts with — or fits the view to — stale positions. The version
    // keys React Flow below: remounting is what makes `fitView` run again, so a
    // new layout is always framed to the canvas.
    const [layout, setLayout] = React.useState({ nodes: initialNodes, version: 0 });
    if (layout.nodes !== initialNodes) {
        setLayout({ nodes: initialNodes, version: layout.version + 1 });
        setNodes(initialNodes);
        setEdges(initialEdges);
    }

    const selectEdge = useCallback((id: string) => {
        setSelectedEdgeId(id);
        setPinnedId(null);
    }, []);

    // Leaving a film clears its hover a beat late, so sliding from one poster
    // to the next across the gap goes straight from one focus to the other
    // instead of flashing the whole graph back to rest in between.
    const hoverClearTimer = useRef<number | undefined>(undefined);
    const hoverNode = useCallback((id: string) => {
        window.clearTimeout(hoverClearTimer.current);
        setHoveredId(id);
    }, []);
    const unhoverNode = useCallback(() => {
        window.clearTimeout(hoverClearTimer.current);
        hoverClearTimer.current = window.setTimeout(() => setHoveredId(null), 150);
    }, []);
    useEffect(() => () => window.clearTimeout(hoverClearTimer.current), []);

    // A selection holds until it's changed by a click: hover only previews
    // while nothing is selected, so passing over other films on the way to the
    // details panel (or anywhere else) doesn't pull focus away.
    const focusedId = pinnedId ?? (selectedEdgeId ? null : hoveredId);

    const focus = useMemo<GraphFocus>(() => {
        let litNodeIds: Set<string> | null = null;
        let litEdgeIds: Set<string> | null = null;

        if (focusedId) {
            const nodeIds = new Set([focusedId]);
            const edgeIds = new Set<string>();
            initialEdges.forEach((e) => {
                if (e.source !== focusedId && e.target !== focusedId) return;
                edgeIds.add(e.id);
                nodeIds.add(e.source);
                nodeIds.add(e.target);
            });
            litNodeIds = nodeIds;
            litEdgeIds = edgeIds;
        } else if (selectedEdgeId) {
            const pair = pairById.get(selectedEdgeId);
            if (pair) {
                litNodeIds = new Set([pair.idA, pair.idB]);
                litEdgeIds = new Set([selectedEdgeId]);
            }
        }

        return {
            focusedId,
            selectedEdgeId,
            hoveredEdgeId,
            litNodeIds,
            litEdgeIds,
            selectEdge,
            hoverEdge: setHoveredEdgeId,
        };
    }, [focusedId, selectedEdgeId, hoveredEdgeId, initialEdges, pairById, selectEdge]);

    const selectedPair = selectedEdgeId ? pairById.get(selectedEdgeId) : undefined;

    const filmCount = initialNodes.length;
    const linkCount = initialEdges.length;

    if (films.length === 0 || initialNodes.length === 0) {
        return (
            <ChartContainer className="" title={GRAPH_TITLE}>
                <p className="py-4 text-center text-sm italic text-slate-400">
                    {films.length === 0
                        ? 'No films to connect yet.'
                        : 'No shared credits found between films.'}
                </p>
            </ChartContainer>
        );
    }

    return (
        <ChartContainer
            className=""
            title={GRAPH_TITLE}
            meta={
                <>
                    <span className="mr-1 font-serif text-sm normal-case tracking-normal tabular-nums text-slate-300">
                        {filmCount}
                    </span>
                    films
                    <span className="mx-2 text-slate-600" aria-hidden="true">
                        ·
                    </span>
                    <span className="mr-1 font-serif text-sm normal-case tracking-normal tabular-nums text-slate-300">
                        {linkCount}
                    </span>
                    tie{linkCount !== 1 ? 's' : ''}
                </>
            }
        >
            <p className="mb-3 px-1 text-xs italic text-slate-400">
                Films joined by shared credits. Tap a connection line to see their common credits.
            </p>
            <div
                ref={canvasRef}
                className={classNames(
                    'relative h-[460px] overflow-hidden rounded-lg border border-slate-600/30 sm:h-[560px]',
                    className
                )}
                onPointerDown={() => setZoomEnabled(true)}
                style={style}
            >
                <GraphFocusContext.Provider value={focus}>
                    <ReactFlow
                        key={layout.version}
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onEdgeClick={(_, edge) => selectEdge(edge.id)}
                        onNodeClick={(_, node) => {
                            setSelectedEdgeId(null);
                            setPinnedId((prev) => (prev === node.id ? null : node.id));
                        }}
                        onNodeMouseEnter={(_, node) => hoverNode(node.id)}
                        onNodeMouseLeave={unhoverNode}
                        onEdgeMouseEnter={(_, edge) => setHoveredEdgeId(edge.id)}
                        onEdgeMouseLeave={() => setHoveredEdgeId(null)}
                        onPaneClick={() => {
                            setPinnedId(null);
                            setSelectedEdgeId(null);
                        }}
                        nodeTypes={nodeTypes}
                        edgeTypes={edgeTypes}
                        fitView
                        fitViewOptions={{ padding: FIT_PADDING }}
                        minZoom={0.2}
                        maxZoom={1.5}
                        zoomOnScroll={zoomEnabled}
                        // Leave the wheel event alone while inactive so it scrolls
                        // the page instead of being swallowed by the canvas.
                        preventScrolling={zoomEnabled}
                        proOptions={{ hideAttribution: true }}
                    >
                        <Background
                            variant={BackgroundVariant.Dots}
                            color="rgba(148, 163, 184, 0.18)"
                            gap={24}
                            size={1}
                        />
                        <GraphControls />
                    </ReactFlow>
                </GraphFocusContext.Provider>

                {!zoomEnabled && (
                    <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-full border border-slate-700/60 bg-slate-900/90 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                        Click to zoom
                    </div>
                )}

                {selectedPair && (
                    <ConnectionDetailPanel
                        detail={{
                            filmA: selectedPair.filmA,
                            filmB: selectedPair.filmB,
                            sharedCredits: selectedPair.shared,
                        }}
                        onClose={() => setSelectedEdgeId(null)}
                        onPersonClick={handlePersonClick}
                    />
                )}

                {/* Always mounted so the modal can run its own close animation. */}
                <CreditsModal
                    isOpen={!!creditsPerson}
                    onClose={() => setCreditsPerson(null)}
                    personName={creditsPerson?.name ?? null}
                    filmography={creditsPerson?.filmography ?? null}
                />
            </div>
        </ChartContainer>
    );
};

export default FilmConnectionGraph;
