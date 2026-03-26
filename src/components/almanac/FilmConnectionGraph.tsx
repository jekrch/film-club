import React, { useMemo, useCallback } from 'react';
import {
    ReactFlow,
    Node,
    Edge,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    Position,
    Handle,
    NodeProps,
    MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import { Film } from '../../types/film';

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
    for (const { field, role } of CREDIT_FIELDS) {
        const value = film[field] as string | undefined;
        if (!value || typeof value !== 'string' || value.toLowerCase() === 'n/a') continue;
        value.split(',').forEach((raw) => {
            const name = raw.trim();
            if (!name) return;
            if (!credits.has(name)) credits.set(name, new Set());
            credits.get(name)!.add(role);
        });
    }
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

function applyDagreLayout(
    nodes: Node<FilmNodeData>[],
    edges: Edge[]
): Node<FilmNodeData>[] {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({
        rankdir: 'TB',
        nodesep: 80,
        ranksep: 120,
        marginx: 40,
        marginy: 40,
    });

    nodes.forEach((node) => {
        g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    });
    edges.forEach((edge) => {
        g.setEdge(edge.source, edge.target);
    });

    dagre.layout(g);

    return nodes.map((node) => {
        const pos = g.node(node.id);
        return {
            ...node,
            position: {
                x: pos.x - NODE_WIDTH / 2,
                y: pos.y - NODE_HEIGHT / 2,
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
}: {
    detail: ConnectionDetail;
    onClose: () => void;
}) {
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
                    {detail.filmA.title} <span style={{ color: '#64748b', fontWeight: 400 }}>&</span>{' '}
                    {detail.filmB.title}
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
                        }}
                    >
                        <span style={{ fontWeight: 500 }}>{sc.name}</span>
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
    const threshold = 1;

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
                label: `${weight}`,
                labelStyle: { fill: '#93c5fd', fontSize: 11, fontWeight: 600 },
                labelBgStyle: { fill: '#0f172a', fillOpacity: 0.85 },
                labelBgPadding: [4, 6] as [number, number],
                labelBgBorderRadius: 4,
                style: {
                    stroke: `rgba(99, 179, 237, ${0.3 + normalised * 0.7})`,
                    strokeWidth: 1.5 + normalised * 3.5,
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
        <div
            className={className}
            style={{
                width: '100%',
                height: 600,
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
                <MiniMap
                    nodeColor={() => '#3b82f6'}
                    maskColor="rgba(15, 23, 42, 0.8)"
                    style={{
                        background: '#1e293b',
                        border: '1px solid #475569',
                        borderRadius: 8,
                    }}
                />
            </ReactFlow>

            {selectedConnection && (
                <ConnectionDetailPanel
                    detail={selectedConnection}
                    onClose={() => setSelectedConnection(null)}
                />
            )}
        </div>
    );
};

export default FilmConnectionGraph;