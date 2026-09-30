/**
 * Classes entered by hand in Setup: one busy block per day a class meets,
 * sharing a group id, so the class can be listed, edited and removed as one.
 */

import type { BusyBlock } from './types.ts';

/** `class-1727712345-2` → `class-1727712345`: the class a day's block belongs to. */
export function classGroup(id: string): string {
  return id.replace(/-\d+$/, '');
}

export interface ClassEntry {
  group: string;
  label: string;
  days: number[];
  startMin: number;
  endMin: number;
  location: string | null;
}

/** Every class once, in the order they were added. */
export function classesOf(busy: BusyBlock[]): ClassEntry[] {
  const out = new Map<string, ClassEntry>();
  for (const b of busy) {
    if (b.kind !== 'class') continue;
    const g = classGroup(b.id);
    const cur = out.get(g);
    if (cur) cur.days = [...cur.days, b.day].sort();
    else out.set(g, { group: g, label: b.label, days: [b.day], startMin: b.startMin, endMin: b.endMin, location: b.location ?? null });
  }
  return [...out.values()];
}

/**
 * Other classes a proposed one would overlap, by name. Touching end to start is
 * not an overlap: a class ending at 12:20 and one starting at 12:20 is a
 * tight walk, not a clash.
 */
export function classClashes(
  busy: BusyBlock[],
  candidate: { days: number[]; startMin: number; endMin: number },
  except?: string,
): string[] {
  const names = new Set<string>();
  for (const b of busy) {
    if (b.kind !== 'class' || classGroup(b.id) === except) continue;
    if (!candidate.days.includes(b.day)) continue;
    if (candidate.startMin < b.endMin && b.startMin < candidate.endMin) names.add(b.label);
  }
  return [...names];
}

/**
 * Where a class is, as a map link. UW first: a location that starts with a
 * building code ("LOW 201", "ECE 105") opens the UW campus map on that
 * building. Anything else is searched as written.
 */
export function mapUrl(location: string): string {
  const code = /^([A-Z]{2,4})\b/.exec(location.trim())?.[1];
  return code
    ? `https://www.washington.edu/maps/?l=${code}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.trim())}`;
}
