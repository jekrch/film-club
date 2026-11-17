import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { routeIdentity } from './routeIdentity';

/**
 * Resets scroll on every route change.
 *
 * Deliberately `useLayoutEffect`: a passive effect runs *after* the browser has
 * painted, so the new page would be painted once at the old page's scroll
 * offset and only then jump to the top — a visible lurch on any navigation
 * that starts from a scrolled position. Running before paint means the first
 * frame of the new route is already at the top.
 *
 * Keyed on the route's identity rather than the bare pathname, so moving
 * between pathnames that are one page (see {@link routeIdentity}) leaves the
 * reader where they were.
 *
 * This is the only place that resets scroll; the data hooks must not do it too.
 */
function ScrollToTop() {
    const { pathname } = useLocation();
    const page = routeIdentity(pathname);

    useLayoutEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, [page]);

    return null;
}

export default ScrollToTop;
