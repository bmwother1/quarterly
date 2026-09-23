'use client';

import { useEffect, useState } from 'react';

/**
 * True the first time a screen is shown in this browser session, false after.
 *
 * For entrance motion that is worth seeing once and tiresome every time: the
 * week arriving row by row is a welcome on the first open of the day and a
 * delay on the tenth.
 *
 * Read in the state initialiser and written in an effect, so a strict-mode
 * double render reads the same answer twice. The server has no session and
 * always says no; the screens that use this render nothing from it until
 * they have hydrated.
 */
export function useFirstVisit(key: string): boolean {
  const [first] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.sessionStorage.getItem(key) === null;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.sessionStorage.setItem(key, '1');
    } catch {
      // Private mode or storage off: the entrance plays every time, which is
      // the harmless way to be wrong.
    }
  }, [key]);

  return first;
}
