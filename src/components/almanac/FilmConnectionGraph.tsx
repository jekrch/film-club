import React, { useMemo, useCallback } from 'react';
import {
    ReactFlow,
    Node,
    Edge,
    Background,
    Controls,
    useNodesState,
    useEdgesState,
    Position,
    Handle,
    NodeProps,
    MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import { Link } from 'react-router-dom';
import { Film } from '../../types/film';
import CreditsModal from '../common/CreditsModal';
import { getAllFilmCreditsForPerson, PersonCredit } from '../../utils/filmUtils';

// Dark theme overrides for ReactFlow controls
const DARK_FLOW_STYLES = `
.react-flow__controls--dark button {
    background: #1e293b !important;
    border-bottom: 1px solid #475569 !important;
    fill: #94a3b8 !important;
    color: #94a3b8 !important;
}
.react-flow__controls--dark button:hover {
    background: #334155 !important;
    fill: #e2e8f0 !important;
}
.dark-flow .react-flow__pane {
    background: transparent;
}
`;

// ─── Types ──────────────────────────────────────────────────────────────────

interface SharedCredit {
    name: string;
    roles: string[]; // roles shared across both films
}

interface FilmEdgeData {
    sharedCredits: SharedCredit[];
    weight: number;
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

const GAP = 80; // spacing between nodes and between packed components

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
    g.setGraph({ rankdir: 'TB', nodesep: GAP, ranksep: 120, marginx: 0, marginy: 0 });

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
 * components are shelf-packed left-to-right, wrapping onto a new row once a
 * roughly square overall bound is reached so the result stays compact.
 */
function applyDagreLayout(
    nodes: Node<FilmNodeData>[],
    edges: Edge[]
): Node<FilmNodeData>[] {
    const components = connectedComponents(nodes.map((n) => n.id), edges)
        .map((ids) => layoutComponent(ids, edges))
        // Tallest first packs into tidier shelves.
        .sort((a, b) => b.height - a.height);

    // Bias the packing toward a wide bound (the graph canvas is much wider than
    // it is tall), so components spread across the width instead of stacking into
    // tall shelves. ASPECT ≈ target width:height of the overall layout.
    const ASPECT = 2.6;
    const totalArea = components.reduce((sum, c) => sum + (c.width + GAP) * (c.height + GAP), 0);
    const targetWidth = Math.max(
        Math.sqrt(totalArea * ASPECT),
        ...components.map((c) => c.width)
    );

    const centreById = new Map<string, { x: number; y: number }>();
    let shelfX = 0;
    let shelfY = 0;
    let shelfHeight = 0;
    components.forEach((c) => {
        if (shelfX > 0 && shelfX + c.width > targetWidth) {
            shelfX = 0;
            shelfY += shelfHeight + GAP;
            shelfHeight = 0;
        }
        c.centres.forEach((p, id) => {
            centreById.set(id, { x: shelfX + p.x, y: shelfY + p.y });
        });
        shelfX += c.width + GAP;
        shelfHeight = Math.max(shelfHeight, c.height);
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

// ─── Custom Film Node ───────────────────────────────────────────────────────

function FilmNode({ data }: NodeProps<Node<FilmNodeData>>) {
    const { film, connectionCount, maxConnections } = data;
    const intensity = maxConnections > 0 ? connectionCount / maxConnections : 0;

    // Border glow scales with how connected the film is
    const glowOpacity = 0.5 + intensity * 0.5;
    const borderColor = `rgba(99, 179, 237, ${glowOpacity})`;

    const posterUrl =
        film.poster && film.poster !== 'N/A'
            ? film.poster
            : undefined;

    return (
        <div
            style={{
                width: NODE_WIDTH,
                height: NODE_HEIGHT,
                border: `2px solid ${borderColor}`,
                borderRadius: 8,
                overflow: 'hidden',
                background: '#1e293b',
                boxShadow: `0 0 ${8 + intensity * 16}px rgba(99, 179, 237, ${glowOpacity * 0.5})`,
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                transition: 'box-shadow 0.2s, border-color 0.2s',
            }}
        >
            <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
            <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />

            {/* Poster area */}
            <div
                style={{
                    flex: 1,
                    background: posterUrl ? `url(${posterUrl}) center/cover no-repeat` : '#334155',
                    minHeight: 0,
                    position: 'relative',
                }}
            >
                {!posterUrl && (
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#64748b',
                            fontSize: 11,
                            padding: 8,
                            textAlign: 'center',
                        }}
                    >
                        No poster
                    </div>
                )}
                {/* Connection badge */}
                {connectionCount > 0 && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 6,
                            right: 6,
                            background: 'rgba(30, 41, 59, 0.9)',
                            color: '#93c5fd',
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 4,
                            backdropFilter: 'blur(4px)',
                        }}
                    >
                        {connectionCount}
                    </div>
                )}
            </div>

            {/* Title bar */}
            <div
                style={{
                    padding: '6px 8px',
                    background: '#0f172a',
                    borderTop: '1px solid #334155',
                }}
            >
                <div
                    style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#e2e8f0',
                        lineHeight: 1.3,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                    title={film.title}
                >
                    {film.title}
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>
                    {film.year}
                </div>
            </div>
        </div>
    );
}

const nodeTypes = { filmNode: FilmNode };

// ─── Edge detail panel ──────────────────────────────────────────────────────

function ConnectionDetailPanel({
    detail,
    onClose,
    onPersonClick,
}: {
    detail: ConnectionDetail;
    onClose: () => void;
    onPersonClick: (name: string) => void;
}) {
    const filmLinkStyle: React.CSSProperties = {
        color: '#e2e8f0',
        textDecoration: 'none',
        borderBottom: '1px dashed rgba(147, 197, 253, 0.5)',
    };
    return (
        <div
            style={{
                position: 'absolute',
                bottom: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#1e293b',
                border: '1px solid #475569',
                borderRadius: 10,
                padding: '16px 20px',
                maxWidth: 420,
                width: '90vw',
                zIndex: 50,
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                color: '#e2e8f0',
                fontSize: 13,
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>
                    <Link to={`/films/${detail.filmA.imdbID}`} onClick={onClose} style={filmLinkStyle}>
                        {detail.filmA.title}
                    </Link>{' '}
                    <span style={{ color: '#64748b', fontWeight: 400 }}>&</span>{' '}
                    <Link to={`/films/${detail.filmB.imdbID}`} onClick={onClose} style={filmLinkStyle}>
                        {detail.filmB.title}
                    </Link>
                </div>
                <button
                    onClick={onClose}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        fontSize: 18,
                        lineHeight: 1,
                        padding: '0 0 0 12px',
                    }}
                >
                    ×
                </button>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
                {detail.sharedCredits.length} shared credit{detail.sharedCredits.length !== 1 ? 's' : ''}
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {detail.sharedCredits.map((sc) => (
                    <li
                        key={sc.name}
                        style={{
                            padding: '4px 0',
                            borderBottom: '1px solid #334155',
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 8,
                            alignItems: 'center',
                        }}
                    >
                        <button
                            onClick={() => onPersonClick(sc.name)}
                            style={{
                                fontWeight: 500,
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                color: '#93c5fd',
                                cursor: 'pointer',
                                textAlign: 'left',
                                font: 'inherit',
                            }}
                            title={`View ${sc.name}'s credits`}
                        >
                            {sc.name}
                        </button>
                        <span style={{ color: '#64748b', fontSize: 11, flexShrink: 0 }}>
                            {sc.roles.join(', ')}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

// ─── Main component ─────────────────────────────────────────────────────────

interface FilmConnectionGraphProps {
    films: Film[];
    className?: string;
    style?: React.CSSProperties;
}

const FilmConnectionGraph: React.FC<FilmConnectionGraphProps> = ({
    films,
    className,
    style,
}) => {
    const [selectedConnection, setSelectedConnection] = React.useState<ConnectionDetail | null>(null);
    const [creditsPerson, setCreditsPerson] = React.useState<{
        name: string;
        filmography: PersonCredit[];
    } | null>(null);
    const threshold = 1;

    const handlePersonClick = useCallback(
        (name: string) => {
            setCreditsPerson({ name, filmography: getAllFilmCreditsForPerson(name, films) });
        },
        [films]
    );

    // Compute all pairwise shared credits once
    const pairData = useMemo(() => {
        const pairs: {
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

        const edges: Edge[] = filteredPairs.map((p) => {
            const weight = p.shared.length;
            const normalised = weight / maxWeight;
            return {
                id: `${p.idA}-${p.idB}`,
                source: p.idA,
                target: p.idB,
                type: 'default',
                animated: weight >= maxWeight * 0.75,
                // Widen the invisible hit area so the thin edges are far easier
                // to click (default is ~20px).
                interactionWidth: 40,
                label: `${weight}`,
                labelStyle: { fill: '#93c5fd', fontSize: 11, fontWeight: 600 },
                labelBgStyle: { fill: '#0f172a', fillOpacity: 0.85 },
                labelBgPadding: [4, 6] as [number, number],
                labelBgBorderRadius: 4,
                style: {
                    stroke: `rgba(99, 179, 237, ${0.3 + normalised * 0.7})`,
                    strokeWidth: 1.5 + normalised * 3.5,
                    cursor: 'pointer',
                },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: `rgba(99, 179, 237, ${0.3 + normalised * 0.7})`,
                    width: 12,
                    height: 12,
                },
                data: { sharedCredits: p.shared, weight } as FilmEdgeData,
            };
        });

        const laid = applyDagreLayout(nodes, edges);
        return { initialNodes: laid, initialEdges: edges };
    }, [films, pairData, threshold, maxWeight]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    // Re-sync when inputs change
    React.useEffect(() => {
        setNodes(initialNodes);
        setEdges(initialEdges);
    }, [initialNodes, initialEdges, setNodes, setEdges]);

    const onEdgeClick = useCallback(
        (_: React.MouseEvent, edge: Edge) => {
            const pair = pairData.find(
                (p) =>
                    (p.idA === edge.source && p.idB === edge.target) ||
                    (p.idB === edge.source && p.idA === edge.target)
            );
            if (pair) {
                setSelectedConnection({
                    filmA: pair.filmA,
                    filmB: pair.filmB,
                    sharedCredits: pair.shared,
                });
            }
        },
        [pairData]
    );

    if (films.length === 0) {
        return (
            <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
                No films provided.
            </div>
        );
    }

    if (initialNodes.length === 0) {
        return (
            <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
                No shared credits found between films.
            </div>
        );
    }

    return (
        <>
        <h3 className="text-xl sm:text-2xl font-semibold text-center mb-6 text-slate-100">Connection Graph</h3>
        <div
            className={className}
            style={{
                width: '100%',
                height: 500,
                borderRadius: 10,
                overflow: 'hidden',
                position: 'relative',
                border: '1px solid #475569',
                ...style,
            }}
        >
            <style>{DARK_FLOW_STYLES}</style>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onEdgeClick={onEdgeClick}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.15 }}
                minZoom={0.2}
                maxZoom={1.5}
                proOptions={{ hideAttribution: true }}
                className="dark-flow"
            >
                <Background color="#334155" gap={24} size={1} />
                <Controls
                    className="react-flow__controls--dark"
                    style={{
                        background: '#1e293b',
                        border: '1px solid #475569',
                        borderRadius: 8,
                    }}
                />
                {/* <MiniMap
                    nodeColor={() => '#3b82f6'}
                    maskColor="rgba(15, 23, 42, 0.8)"
                    style={{
                        background: '#1e293b',
                        border: '1px solid #475569',
                        borderRadius: 8,
                    }}
                /> */}
            </ReactFlow>

            {selectedConnection && (
                <ConnectionDetailPanel
                    detail={selectedConnection}
                    onClose={() => setSelectedConnection(null)}
                    onPersonClick={handlePersonClick}
                />
            )}

            {creditsPerson && (
                <CreditsModal
                    isOpen
                    onClose={() => setCreditsPerson(null)}
                    personName={creditsPerson.name}
                    filmography={creditsPerson.filmography}
                />
            )}
        </div>
        </>
    );
};

export default FilmConnectionGraph;