import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImageViewer, type ViewerItem } from '@jekrch/react-viewport-lightbox';

interface FilmStillsProps {
    /** Ordered list of still image URLs (backdrops + cover). */
    images: string[];
    /** Film title, used for accessible labels and the modal heading. */
    title: string;
}

// Geometry for the stacked-thumbnail trigger.
const THUMB_W = 56; // px (w-14)
const THUMB_OVERLAP = 22; // px each successive thumb is shifted right

/**
 * A "Stills" link rendered as a small stack of overlapping thumbnails. Clicking
 * it opens a full-screen lightbox powered by `@jekrch/react-viewport-lightbox`
 * — swipe / drag to navigate, scroll / pinch / double-click to zoom and pan.
 */
const FilmStills: React.FC<FilmStillsProps> = ({ images, title }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [index, setIndex] = useState(0);

    // Source elements for the shared-element open/close transition. These are the
    // wrappers *around* each thumbnail, not the `img` itself: the viewer looks for
    // a descendant `img` to read the `object-fit: cover` crop off, and takes the
    // flight's corner radius from the element handed over.
    const thumbRefs = useRef<(HTMLSpanElement | null)[]>([]);

    // Return the thumbnail backing `i`, or null when there's no visible source
    // (only the first few stills are previewed; failed loads are hidden) so the
    // viewer falls back to its default fade for that index.
    const getOrigin = (i: number): HTMLElement | null => {
        const el = thumbRefs.current[i];
        if (!el || el.style.display === 'none') return null;
        return el;
    };

    // Final, ready-to-load urls — the consumer (this component) resolves them, so
    // they're passed to the viewer verbatim.
    const items = useMemo<ViewerItem[]>(
        () =>
            images.map((src, i) => ({
                id: src,
                src,
                alt: `${title} still ${i + 1}`,
            })),
        [images, title]
    );

    if (images.length === 0) return null;

    const open = () => {
        setIndex(0);
        setIsOpen(true);
    };

    // The trigger shows up to three overlapping thumbnails. Width is computed so
    // the stack is never clipped regardless of how many previews are shown.
    const previewThumbs = images.slice(0, 3);
    const stackWidth = THUMB_W + (previewThumbs.length - 1) * THUMB_OVERLAP;

    return (
        <>
            <button
                type="button"
                onClick={open}
                className="group inline-flex items-center gap-3 focus:outline-none focus:ring-1 focus:ring-blue-400/50 rounded-md"
                aria-label={`View ${images.length} stills from ${title}`}
            >
                <span className="relative h-9 flex-shrink-0" style={{ width: stackWidth }}>
                    {previewThumbs.map((src, i) => (
                        <span
                            key={src}
                            ref={(el) => {
                                thumbRefs.current[i] = el;
                            }}
                            aria-hidden="true"
                            className="absolute top-0 block h-9 w-14 overflow-hidden rounded ring-1 ring-slate-600/80 shadow-md shadow-black/40 transition-transform duration-200 group-hover:-translate-y-0.5"
                            style={{ left: i * THUMB_OVERLAP, zIndex: previewThumbs.length - i }}
                        >
                            <img
                                src={src}
                                alt=""
                                className="h-full w-full object-cover"
                                onError={() => {
                                    const wrapper = thumbRefs.current[i];
                                    if (wrapper) wrapper.style.display = 'none';
                                }}
                            />
                        </span>
                    ))}
                </span>
                <span className="flex flex-col items-start leading-tight">
                    <span className="text-sm font-semibold text-blue-400 group-hover:text-blue-300 transition-colors">
                        Stills
                    </span>
                    <span className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">
                        {images.length} image{images.length === 1 ? '' : 's'}
                    </span>
                </span>
            </button>

            {isOpen &&
                createPortal(
                    <ImageViewer
                        items={items}
                        index={index}
                        loop={true}
                        getOrigin={getOrigin}
                        closeOnBackdropClick={true}
                        onIndexChange={setIndex}
                        onClose={() => setIsOpen(false)}
                        ariaLabel={`${title} — stills`}
                        classNames={{ root: 'film-stills-viewer' }}
                        renderHeader={() => (
                            <p className="rvl-header-title font-semibold truncate">
                                {title}
                                <span className="ml-2 text-slate-400 font-normal">Stills</span>
                            </p>
                        )}
                    />,
                    document.body
                )}
        </>
    );
};

export default FilmStills;
