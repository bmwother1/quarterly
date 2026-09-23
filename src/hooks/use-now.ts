'use client';

import { useEffect, useState } from 'react';

/**
 * The time, kept current, for labels like "in 20 min".
 *
 * Only for what is shown. Anything that decides something (which blocks are
 * missed, whether this is a lapse or an absence) reads a clock fixed at mount,
 * so a decision cannot change under the student while they are looking at it.
 */
export function useNow(everyMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}
