import { useEffect, useState } from 'react';

/** Subscribe to a CSS media query; SSR-safe default is false. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Buy sidebar stacks / sheet layout (matches CSS @media max-width: 900px). */
export const MOBILE_BUY_MQ = '(max-width: 900px)';
/** Compact nav / phone layout. */
export const COMPACT_NAV_MQ = '(max-width: 720px)';
