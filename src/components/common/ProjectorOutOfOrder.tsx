import React from 'react';
import Button from './Button';

/**
 * The crash screen, rendered by ErrorBoundary. The boundary wraps the whole app,
 * navbar and footer included, so this stands on its own in the viewport.
 */
const ProjectorOutOfOrder: React.FC = () => (
    <div className="flex min-h-screen items-center justify-center px-4 py-24 text-center">
        <div className="page-enter mx-auto max-w-xl">
            <Projector className="mx-auto h-auto w-44 text-slate-500" />
            <h1 role="alert" className="mt-8 font-serif text-3xl text-slate-100">
                The projector&rsquo;s on the fritz
            </h1>
            <p className="mt-3 text-slate-400">Something went wrong while showing this page.</p>
            <div className="mt-8 flex items-center justify-center gap-6">
                {/* A full page load rather than a router Link: the boundary only
                    resets when the path changes, so a Link to "/" from a crash on
                    "/" would leave this screen up. Reloading also drops whatever
                    state broke the page. */}
                <Button
                    variant="solid"
                    size="md"
                    accent="blue"
                    onClick={() => window.location.assign('/')}
                >
                    Back to the lobby
                </Button>
                <Button variant="link" accent="neutral" onClick={() => window.location.reload()}>
                    Try again
                </Button>
            </div>
        </div>
    </div>
);

/**
 * An old reel-to-reel projector in outline, drawn in `currentColor`. The reels
 * catch as they turn and the beam flickers; see `.projector-*` in index.css.
 */
const Projector: React.FC<{ className?: string }> = ({ className }) => (
    <svg
        viewBox="0 0 200 120"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <polygon
            className="projector-beam"
            points="158,72 200,52 200,96"
            fill="currentColor"
            fillOpacity="0.18"
            stroke="none"
        />
        <Reel cx={50} cy={32} r={22} className="projector-reel" />
        <Reel cx={112} cy={36} r={17} className="projector-reel projector-reel-rear" />
        <path d="M50 54 L58 60 M112 53 L104 60" />
        <rect x="40" y="60" width="96" height="26" rx="4" />
        <path d="M136 66 h14 v12 h-14 M150 64 h8 v16 h-8" />
        <path d="M76 86 L62 112 M88 86 V114 M100 86 L114 112" />
    </svg>
);

/** A film reel: rim, hub and five cut-outs, turning about its own centre. */
const Reel: React.FC<{ cx: number; cy: number; r: number; className?: string }> = ({
    cx,
    cy,
    r,
    className,
}) => (
    <g className={className}>
        <circle cx={cx} cy={cy} r={r} />
        <circle cx={cx} cy={cy} r={r * 0.14} />
        {Array.from({ length: 5 }, (_, i) => {
            const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
            return (
                <circle
                    key={i}
                    cx={cx + Math.cos(a) * r * 0.55}
                    cy={cy + Math.sin(a) * r * 0.55}
                    r={r * 0.2}
                />
            );
        })}
    </g>
);

export default ProjectorOutOfOrder;
