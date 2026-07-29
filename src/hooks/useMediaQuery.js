import { useEffect, useState } from 'react';

/**
 * Tracks a CSS media query in JS (e.g. `useMediaQuery('(max-width: 1024px)')`).
 * Needed where layout mode (not just styling) branches on viewport width —
 * pure CSS `@media` can't drive that, only look/feel.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
