import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { MAX_SCALE, MIN_SCALE, useZoomPan } from '../../hooks/useZoomPan';
import { useSlideNavigation } from '../../hooks/useSlideNavigation';
import { useGestureHandler } from '../../hooks/useGestureHandler';

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
 * it opens a full-screen lightbox (StillsLightbox) modelled on comic-snaps'
 * PanelViewer — swipe / drag to navigate, scroll / pinch / double-click to zoom
 * and pan.
 */
const FilmStills: React.FC<FilmStillsProps> = ({ images, title }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (images.length === 0) return null;

  // The trigger shows up to three overlapping thumbnails. Width is computed so
  // the stack is never clipped regardless of how many previews are shown.
  const previewThumbs = images.slice(0, 3);
  const stackWidth = THUMB_W + (previewThumbs.length - 1) * THUMB_OVERLAP;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="group inline-flex items-center gap-3 focus:outline-none focus:ring-1 focus:ring-blue-400/50 rounded-md"
        aria-label={`View ${images.length} stills from ${title}`}
      >
        <span className="relative h-9 flex-shrink-0" style={{ width: stackWidth }}>
          {previewThumbs.map((src, i) => (
            <img
              key={src}
              src={src}
              alt=""
              aria-hidden="true"
              className="absolute top-0 h-9 w-14 rounded object-cover ring-1 ring-slate-600/80 shadow-md shadow-black/40 transition-transform duration-200 group-hover:-translate-y-0.5"
              style={{ left: i * THUMB_OVERLAP, zIndex: i }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
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
          <StillsLightbox images={images} title={title} onClose={() => setIsOpen(false)} />,
          document.body,
        )}
    </>
  );
};

interface StillsLightboxProps {
  images: string[];
  title: string;
  onClose: () => void;
}

/**
 * The full-screen stills viewer. Mounted only while open so the zoom/pan and
 * slide hooks initialise with their refs attached, mirroring how PanelViewer is
 * mounted on demand.
 */
const StillsLightbox: React.FC<StillsLightboxProps> = ({ images, title, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);

  const imgWrapperRef = useRef<HTMLDivElement>(null);

  useBodyScrollLock(true);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  const zoomPan = useZoomPan(imgWrapperRef, currentIndex);
  const {
    imgRef,
    displayScale,
    isZoomed,
    transformRef,
    resetTransform,
    setTransform,
    clampTranslate,
    measureBaseDims,
    handleDoubleClick,
  } = zoomPan;

  const slide = useSlideNavigation(images, currentIndex, setCurrentIndex);
  const { slideTrackRef, slideActive, slideAnimating, swipeOffset, commitSlide } = slide;

  const gestures = useGestureHandler(zoomPan, slide, hasPrev, hasNext);

  // Animate in.
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleClose = useCallback(() => {
    setClosing(true);
    setVisible(false);
    setTimeout(onClose, 250);
  }, [onClose]);

  const handleNavigate = useCallback(
    (dir: 'prev' | 'next') => commitSlide(dir),
    [commitSlide],
  );

  // Keyboard navigation.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
      else if (e.key === 'ArrowLeft' && hasPrev && displayScale <= 1) handleNavigate('prev');
      else if (e.key === 'ArrowRight' && hasNext && displayScale <= 1) handleNavigate('next');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleClose, handleNavigate, hasPrev, hasNext, displayScale]);

  const open = visible && !closing;
  const imgStyle: React.CSSProperties = {
    maxWidth: '94vw',
    maxHeight: 'calc(100vh - 12rem)',
    willChange: 'transform',
  };

  // Adjacent slides for the swipe carousel.
  const prevSrc = hasPrev ? images[currentIndex - 1] : null;
  const nextSrc = hasNext ? images[currentIndex + 1] : null;
  const showAdjacent = slideActive || slideAnimating || swipeOffset !== 0;
  const adjacentOpacity = Math.min(1, Math.abs(swipeOffset) / (viewportWidth * 0.8));

  const zoomTo = (factor: number) => {
    const t = transformRef.current;
    const next = factor > 1
      ? Math.min(MAX_SCALE, t.scale * factor)
      : Math.max(MIN_SCALE, t.scale * factor);
    const clamped = next <= 1 ? { x: 0, y: 0 } : clampTranslate(t.x, t.y, next);
    setTransform({ scale: next, ...clamped }, true);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-colors duration-[250ms] ease-out ${open ? 'bg-black/90' : 'bg-black/0'}`}
      style={{ touchAction: 'none' }}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} — stills`}
    >
      {/* Clickable, blurred backdrop. */}
      <div
        className={`absolute inset-0 z-0 transition-all duration-[250ms] ease-out ${open ? 'backdrop-blur-sm' : 'backdrop-blur-0'}`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Top bar */}
      <div
        className={`absolute top-0 inset-x-0 z-20 flex items-start justify-between px-4 py-3 sm:px-6 sm:py-4 bg-gradient-to-b from-black/70 via-black/40 to-transparent transition-all duration-[250ms] ease-out ${open ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3'}`}
        style={{ pointerEvents: 'none' }}
      >
        <div className="min-w-0" style={{ pointerEvents: 'auto' }}>
          <p className="text-sm font-semibold text-slate-100 leading-snug truncate">
            {title}
            <span className="ml-2 text-slate-400 font-normal">Stills</span>
          </p>
          <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
            {currentIndex + 1} / {images.length}
          </p>
        </div>

        <div className="flex items-center gap-1 ml-3 flex-shrink-0" style={{ pointerEvents: 'auto' }}>
          {!isTouchDevice && isZoomed && (
            <button
              onClick={(e) => { e.stopPropagation(); resetTransform(); }}
              className="text-[11px] tabular-nums font-mono text-slate-200 hover:text-white rounded px-2 py-1.5 hover:bg-white/10 transition-colors"
              title="Reset zoom"
            >
              {Math.round(displayScale * 100)}%
            </button>
          )}
          {!isTouchDevice && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); zoomTo(1.3); }}
                className="text-slate-200 hover:text-white rounded-full p-1.5 hover:bg-white/10 transition-colors"
                title="Zoom in"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607ZM10.5 7.5v6m3-3h-6" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); zoomTo(1 / 1.3); }}
                className="text-slate-200 hover:text-white rounded-full p-1.5 hover:bg-white/10 transition-colors"
                title="Zoom out"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607ZM13.5 10.5h-6" />
                </svg>
              </button>
            </>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); handleClose(); }}
            className="text-slate-300 hover:text-white rounded-full p-1.5 hover:bg-white/10 transition-colors ml-1"
            title="Close (Esc)"
            aria-label="Close stills"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Slide track: three slots (prev / current / next). */}
      <div
        ref={slideTrackRef}
        className={`relative z-10 flex items-center justify-center w-full h-full transition-opacity duration-[250ms] ease-out ${open ? 'opacity-100' : 'opacity-0'}`}
        style={{ touchAction: 'none', pointerEvents: 'none' }}
      >
        {showAdjacent && prevSrc && (
          <div
            className="absolute inset-0 flex items-center justify-center select-none pointer-events-none"
            style={{ transform: `translateX(-${viewportWidth}px)`, opacity: adjacentOpacity }}
          >
            <img src={prevSrc} alt="" className="block w-auto h-auto object-contain rounded-md" style={imgStyle} draggable={false} />
          </div>
        )}

        <div
          ref={imgWrapperRef}
          className="relative flex items-center justify-center select-none overflow-hidden"
          style={{ touchAction: 'none', pointerEvents: 'auto' }}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={handleDoubleClick}
          onPointerDown={gestures.handlePointerDown}
          onPointerMove={gestures.handlePointerMove}
          onPointerUp={gestures.handlePointerUp}
          onPointerLeave={gestures.handlePointerUp}
          onTouchStart={gestures.handleTouchStart}
          onTouchMove={gestures.handleTouchMove}
          onTouchEnd={gestures.handleTouchEnd}
        >
          <img
            ref={imgRef}
            src={images[currentIndex]}
            alt={`${title} still ${currentIndex + 1}`}
            className="block w-auto h-auto object-contain rounded-md shadow-2xl"
            style={imgStyle}
            draggable={false}
            onLoad={measureBaseDims}
          />
        </div>

        {showAdjacent && nextSrc && (
          <div
            className="absolute inset-0 flex items-center justify-center select-none pointer-events-none"
            style={{ transform: `translateX(${viewportWidth}px)`, opacity: adjacentOpacity }}
          >
            <img src={nextSrc} alt="" className="block w-auto h-auto object-contain rounded-md" style={imgStyle} draggable={false} />
          </div>
        )}
      </div>

      {/* Bottom bar: nav + counter + thumbnail rail (hidden while zoomed). */}
      {!isZoomed && (
        <div
          className={`absolute bottom-0 inset-x-0 z-20 pt-6 pb-4 flex flex-col items-center gap-3 bg-gradient-to-t from-black/70 via-black/40 to-transparent transition-all duration-[250ms] ease-out ${open ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
        >
          {images.length > 1 && (
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => handleNavigate('prev')}
                disabled={!hasPrev}
                className="text-slate-200 hover:text-white disabled:opacity-30 disabled:cursor-default transition-colors rounded-full p-2 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-slate-500"
                aria-label="Previous still"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                </svg>
              </button>
              <span className="text-xs text-slate-400 tabular-nums tracking-wide select-none min-w-[3.5rem] text-center">
                {currentIndex + 1} / {images.length}
              </span>
              <button
                onClick={() => handleNavigate('next')}
                disabled={!hasNext}
                className="text-slate-200 hover:text-white disabled:opacity-30 disabled:cursor-default transition-colors rounded-full p-2 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-slate-500"
                aria-label="Next still"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          )}

          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto max-w-full px-4 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
              {images.map((src, i) => (
                <button
                  key={src}
                  onClick={() => setCurrentIndex(i)}
                  className={`flex-shrink-0 h-12 w-20 rounded overflow-hidden border-2 transition-all focus:outline-none ${i === currentIndex ? 'border-blue-400 opacity-100' : 'border-transparent opacity-50 hover:opacity-90'}`}
                  aria-label={`View still ${i + 1}`}
                  aria-current={i === currentIndex}
                >
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {!isTouchDevice && (
            <p className="text-[11px] text-slate-500 tracking-wide">
              ← → or drag to navigate · scroll or double-click to zoom · esc to close
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default FilmStills;
