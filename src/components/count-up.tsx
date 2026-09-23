'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A number that counts up to its new value instead of swapping.
 *
 * Only upward changes animate: a count that rises is progress worth seeing
 * happen, and one that falls (an undo, a replan) should just be right. It
 * runs for at most 240ms on the app's decelerating curve, and not at all
 * under reduced motion. Figures are tabular, so the width never changes
 * while it runs.
 */
export function CountUp({ value, format = String }: { value: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (value <= start || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(value);
      return;
    }
    const began = performance.now();
    const duration = 240;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - began) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(start + (value - start) * eased);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{format(shown)}</>;
}
