// The capital is traced from the Ionic capital in the nav icon: a cornice bar
// over a second, shorter one, two scrolls, and the wedge / bar / boxed-square /
// bar / wedge run between them, sitting on the plate the shaft rises into.
// Everything but the scroll coils is solid — in the icon the shapes read as
// masses bounded by line, and against this dark page the mass is what carries
// them, especially at the 5-14% opacity these render at. Coordinates live in the
// same 50-unit-wide space as the rest of the pillar and are scaled with a
// transform, so the head holds its proportions at every pillar width. The shaft
// below is untouched.
const CAPITAL_UNITS = 17.5; // capital occupies y 0-17.5, where the shaft begins

// A scroll: the coil starts at the top of the volute, under the cornice, and
// makes a turn and a quarter before stopping short of the eye — enough to read
// as a scroll without winding into a knot. It is built as a filled ribbon rather
// than a stroked line so it can swell out of the start and taper to a point at
// the finish, the way the icon's scroll is cut. Radius drops by a fixed amount
// per turn, keeping the turns evenly spaced.
const VOLUTE_TURNS = 1.25;
const VOLUTE_END_R = 1.8;
const RIBBON = { start: 0.9, max: 2.2, end: 0.3 };

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

// Ribbon width along the coil: swells over the first third, tapers from there.
const ribbonWidth = (t: number): number =>
    t < 0.3
        ? RIBBON.start + (RIBBON.max - RIBBON.start) * smoothstep(t / 0.3)
        : RIBBON.max + (RIBBON.end - RIBBON.max) * smoothstep((t - 0.3) / 0.7);

const volutePath = (cx: number, cy: number, r: number, clockwise: boolean): string => {
    const steps = 56;
    const sweep = (clockwise ? 1 : -1) * VOLUTE_TURNS * 2 * Math.PI;
    const spine = Array.from({ length: steps + 1 }, (_, i) => {
        const t = i / steps;
        const angle = -Math.PI / 2 + sweep * t; // starts at the top of the volute
        const radius = r - (r - VOLUTE_END_R) * t;
        return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle), t };
    });

    const edges = spine.map((p, i) => {
        const before = spine[Math.max(0, i - 1)];
        const after = spine[Math.min(steps, i + 1)];
        const dx = after.x - before.x;
        const dy = after.y - before.y;
        const len = Math.hypot(dx, dy) || 1;
        const half = ribbonWidth(p.t) / 2;
        const nx = (-dy / len) * half;
        const ny = (dx / len) * half;
        return [
            `${(p.x + nx).toFixed(2)} ${(p.y + ny).toFixed(2)}`,
            `${(p.x - nx).toFixed(2)} ${(p.y - ny).toFixed(2)}`,
        ];
    });

    const outer = edges.map((e) => e[0]);
    const inner = edges.map((e) => e[1]).reverse();
    return `M ${outer.join(' L ')} L ${inner.join(' L ')} Z`;
};

const VOLUTE = { cy: 10.9, r: 5, cx: [7, 43] };
const MOTIF_TOP = 6.4;
const MOTIF_BOTTOM = 12.6;

// Wedge closing the run at either end: horizontal top, vertical spine on the
// inner side and a diagonal back up to the tip, clipped flat at the bottom the
// way the icon draws it.
const BOX_X = 22;
const BOX_W = 6;
const HOLE = 2.4;
const HOLE_X = BOX_X + (BOX_W - HOLE) / 2;
const HOLE_Y = (MOTIF_TOP + MOTIF_BOTTOM - HOLE) / 2;

const wedge = (spine: number, tip: number): string =>
    `M ${tip} ${MOTIF_TOP} H ${spine} V ${MOTIF_BOTTOM} H ${spine + (tip - spine) * 0.3} Z`;

const IonicCapital: React.FC<{ scale: number }> = ({ scale }) => (
    <g transform={`scale(${scale})`} className="text-slate-200">
        <g fill="currentColor">
            {/* Cornice: a solid bar over a second, shorter one */}
            <rect x={3} y={0.5} width={44} height={1.6} rx={0.4} />
            <rect x={4.8} y={3} width={40.4} height={1.4} rx={0.4} />

            {/* Wedge, bar, boxed square, bar, wedge */}
            <path d={wedge(16, 11.5)} />
            <path d={wedge(34, 38.5)} />
            <rect x={17.5} y={MOTIF_TOP} width={3} height={MOTIF_BOTTOM - MOTIF_TOP} />
            <rect x={29.5} y={MOTIF_TOP} width={3} height={MOTIF_BOTTOM - MOTIF_TOP} />
            {/* The centre square keeps its opening, so it is drawn as one path.
                The opening is centred in the square rather than measured to it. */}
            <path
                fillRule="evenodd"
                d={
                    `M ${BOX_X} ${MOTIF_TOP} H ${BOX_X + BOX_W} V ${MOTIF_BOTTOM} H ${BOX_X} Z ` +
                    `M ${HOLE_X} ${HOLE_Y} H ${HOLE_X + HOLE} V ${HOLE_Y + HOLE} H ${HOLE_X} Z`
                }
            />

            {/* The plate the shaft rises into, tucked between the scrolls */}
            <rect x={10.1} y={14.4} width={29.8} height={1.6} rx={0.4} />

            {/* The scrolls, and the eye each one tapers into */}
            {VOLUTE.cx.map((cx, i) => (
                <path key={cx} d={volutePath(cx, VOLUTE.cy, VOLUTE.r, i === 1)} />
            ))}
            {VOLUTE.cx.map((cx) => (
                <circle key={cx} cx={cx} cy={VOLUTE.cy} r={0.75} />
            ))}
        </g>
    </g>
);

const CorinthianPillar: React.FC<{
    side: 'left' | 'right';
    className?: string;
    flipped?: boolean;
    width?: number; // pixel width for the pillar
    opacity?: number; // 0-1; lets callers compensate for the backdrop behind the pillar
}> = ({ side, className = '', flipped = false, width = 40, opacity = 0.15 }) => {
    // Mirrored inset: the same step at each breakpoint on both sides, so the two
    // pillars stand equally far in from their edges. The right used to sit 8px
    // nearer its edge than the left did below `lg`, which read as the colonnade
    // being off-centre around the banner.
    const positionClass =
        side === 'left' ? 'left-0 sm:left-2 lg:left-8' : 'right-0 sm:right-2 lg:right-8';

    // Scale factor based on desired width (original viewBox width is 50)
    const scale = width / 50;

    // Scaled dimensions
    const capitalHeight = Math.round(CAPITAL_UNITS * scale);
    const shaftWidth = Math.round(22 * scale);
    const shaftX = Math.round(14 * scale);
    const baseWidths = [26, 30, 34].map((w) => Math.round(w * scale));
    const baseXs = [12, 10, 8].map((x) => Math.round(x * scale));

    // Fluting positions (evenly spaced within shaft)
    const flutePositions = [17, 21, 25, 29, 33].map((x) => Math.round(x * scale));
    const fluteStroke = Math.max(0.5, 0.75 * scale);

    if (!flipped) {
        const totalHeight = Math.round(200 * scale);
        return (
            <svg
                viewBox={`0 0 ${width} ${totalHeight}`}
                width={width}
                height={totalHeight}
                className={`absolute top-2 ${positionClass} transition-opacity duration-500 ${className}`}
                style={{ opacity }}
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
            >
                {/* Capital */}
                <IonicCapital scale={scale} />

                {/* Shaft */}
                <rect
                    x={shaftX}
                    y={Math.round(CAPITAL_UNITS * scale)}
                    width={shaftWidth}
                    height={Math.round((183 - CAPITAL_UNITS) * scale)}
                    fill="currentColor"
                    className="text-slate-200"
                />

                {/* Fluting */}
                {flutePositions.map((x, i) => (
                    <line
                        key={i}
                        x1={x}
                        y1={Math.round((CAPITAL_UNITS + 2) * scale)}
                        x2={x}
                        y2={Math.round(181 * scale)}
                        stroke="currentColor"
                        strokeWidth={fluteStroke}
                        className="text-slate-400"
                    />
                ))}

                {/* Base */}
                <rect
                    x={baseXs[0]}
                    y={Math.round(185 * scale)}
                    width={baseWidths[0]}
                    height={Math.round(2.5 * scale)}
                    rx={0.5 * scale}
                    fill="currentColor"
                    className="text-slate-200"
                />
                <rect
                    x={baseXs[1]}
                    y={Math.round(190 * scale)}
                    width={baseWidths[1]}
                    height={Math.round(3 * scale)}
                    rx={0.5 * scale}
                    fill="currentColor"
                    className="text-slate-200"
                />
                <rect
                    x={baseXs[2]}
                    y={Math.round(195 * scale)}
                    width={baseWidths[2]}
                    height={Math.round(4 * scale)}
                    rx={scale}
                    fill="currentColor"
                    className="text-slate-200"
                />
            </svg>
        );
    }

    // Flipped: capital at top (fixed size), shaft stretches down
    return (
        <div
            className={`absolute top-0 ${positionClass} h-full flex flex-col transition-opacity duration-500 ${className}`}
            style={{ width: `${width}px`, opacity }}
            aria-hidden="true"
        >
            {/* Capital - fixed height, crisp rendering */}
            <svg
                viewBox={`0 0 ${width} ${capitalHeight}`}
                width={width}
                height={capitalHeight}
                className="flex-shrink-0"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <IonicCapital scale={scale} />
            </svg>

            {/* Shaft - stretches to fill remaining height */}
            <svg
                viewBox={`0 0 ${width} 100`}
                className="w-full flex-grow"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="none"
            >
                <rect
                    x={shaftX}
                    y="0"
                    width={shaftWidth}
                    height="100"
                    fill="currentColor"
                    className="text-slate-200"
                />
                {flutePositions.map((x, i) => (
                    <line
                        key={i}
                        x1={x}
                        y1="0"
                        x2={x}
                        y2="100"
                        stroke="currentColor"
                        strokeWidth={fluteStroke}
                        className="text-slate-700"
                    />
                ))}
            </svg>
        </div>
    );
};

export default CorinthianPillar;
