import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Resets scroll on every route change.
 *
 * Deliberately `useLayoutEffect`: a passive effect runs *after* the browser has
 * painted, so the new page would be painted once at the old page's scroll
 * offset and only then jump to the top — a visible lurch on any navigation
 * that starts from a scrolled position. Running before paint means the first
 * frame of the new route is already at the top.
 *
 * This is the only place that resets scroll; the data hooks must not do it too.
 */
function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname]);

  return null;
}

export default ScrollToTop;