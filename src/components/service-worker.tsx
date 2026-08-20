'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker.
 *
 * Only in production: in development the cache fights hot reload and produces
 * the confusing "my change didn't apply" symptom that has already cost this
 * project real time.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Offline support is an enhancement. Failing to register it must never
        // break the app for someone who is online.
      });
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
