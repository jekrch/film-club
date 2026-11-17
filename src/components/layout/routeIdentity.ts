/**
 * Which "page" a pathname is, for the things that happen when the reader
 * arrives at a new one: the enter animation (PageTransition) and the scroll
 * reset (ScrollToTop).
 *
 * Usually the pathname itself. The retrospective covers are the exception:
 * `/retrospective/:year` and `/retrospective/:year/:member` are one page whose
 * year and member pickers swap what it shows. Moving between them animates
 * inside the page (see RetrospectivePage) and keeps the reader where they
 * were, rather than replaying the whole page's entrance and jumping to the top
 * under the picker they just pressed.
 */
export const routeIdentity = (pathname: string): string =>
    /^\/retrospective\/\d{4}(\/[^/]+)?\/?$/.test(pathname) ? '/retrospective' : pathname;
