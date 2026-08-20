import type { MetadataRoute } from 'next';

/**
 * Web app manifest — what makes this installable rather than a bookmark.
 *
 * `display: standalone` removes the browser chrome so it opens like an app,
 * which is most of what "it's an app" means to a student. Native comes after
 * people are actually using it, not before.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Quarterly',
    short_name: 'Quarterly',
    description: 'Your week, planned around the life you actually have.',
    start_url: '/week',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#14120f',
    theme_color: '#14120f',
    categories: ['productivity', 'education'],
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
