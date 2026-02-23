/**
 * components/ScrollToTop.jsx
 *
 * Scrolls the window to (0, 0) on every route change.
 *
 * Why this is needed:
 *   React Router DOM doesn't restore/reset scroll position between routes
 *   by default.  Without this component, navigating from /investigation/:id
 *   back to / (or vice versa) would leave the viewport wherever it was on
 *   the previous page — the nav links, hero, and upload sections would be
 *   invisible with no indication of what happened.
 *
 * Usage:
 *   Place once inside <BrowserRouter> (or its nearest descendent that has
 *   access to the router context) — typically at the top of App.jsx, before
 *   any <Routes> declarations:
 *
 *     <ScrollToTop />
 *     <Routes>
 *       <Route path="/" element={<ScrollHome />} />
 *       ...
 *     </Routes>
 *
 * This component renders nothing — it is a pure side-effect hook.
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // `instant` avoids the jarring visual jump that `smooth` would cause
    // mid-page.  The new page always starts clean at the top.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}
