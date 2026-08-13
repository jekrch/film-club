import React from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Eases each route's content into place instead of cutting to it.
 *
 * All of this site's data is imported JSON, so a new page is ready to paint on
 * the same frame the navigation happens: content appears at full opacity with
 * no ramp, which reads as a blink rather than as a page arriving. A short
 * fade-and-lift gives the eye something to follow.
 *
 * Enter-only, and deliberately so. An exit animation (framer-motion's
 * `AnimatePresence mode="wait"`, say) has to keep the outgoing page mounted
 * while it plays, which both adds its duration to every navigation and leaves
 * ScrollToTop resetting scroll under a page the user is still looking at. A CSS
 * keyframe on the incoming content costs nothing and can't desync from routing.
 *
 * Keyed on `pathname`, not on `location.key`: a re-navigation to the page
 * you're already on shouldn't replay the animation.
 */
const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pathname } = useLocation();

  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
};

export default PageTransition;
