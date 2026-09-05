/**
 * Export and import.
 *
 * The privacy page tells students the truth: their schedule exists only in this
 * browser and clearing site data destroys it, with no copy anywhere to ask for.
 * That's an honest description of a real hazard, and until sync lands the only
 * defence is letting people take their own copy.
 *
 * It also makes moving from laptop to phone possible today, which is most of
 * what sync will do — just manually.
 */

import type { HeronState } from './store.ts';
import { emptyState } from './store.ts';

export interface BackupFile {
  format: 'heron-backup';
  version: number;
  exportedAt: string;
  state: HeronState;
}

export function toBackup(state: HeronState): BackupFile {
  return {
    format: 'heron-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    state,
  };
}

export function backupFilename(now = new Date()): string {
  return `heron-${now.toISOString().slice(0, 10)}.json`;
}

export type ImportResult =
  | { ok: true; state: HeronState; summary: string }
  | { ok: false; error: string };

/**
 * Read a backup back in.
 *
 * Deliberately forgiving about shape and strict about identity. A file from a
 * newer build may carry fields this one has never heard of, and merging over a
 * fresh empty state means an unknown extra is harmless while a missing field
 * can't leave something undefined and crash a render. But a file that isn't one
 * of ours is rejected outright rather than half-loaded.
 */
export function fromBackup(raw: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, error: "That file doesn't contain a backup." };
  }

  const file = parsed as Partial<BackupFile>;
  if (file.format !== 'heron-backup') {
    return { ok: false, error: 'That looks like a different kind of file. Expected a Heron backup.' };
  }
  if (typeof file.state !== 'object' || file.state === null) {
    return { ok: false, error: 'That backup is missing its contents.' };
  }

  const state: HeronState = { ...emptyState(), ...file.state };

  // Anything that should be a list must be one, or a render downstream throws.
  for (const key of ['courses', 'assignments', 'commitments', 'events', 'blocks', 'unscheduled'] as const) {
    if (!Array.isArray(state[key])) {
      return { ok: false, error: `That backup is damaged: "${key}" isn't a list.` };
    }
  }
  if (typeof state.availability !== 'object' || !Array.isArray(state.availability?.busy)) {
    return { ok: false, error: 'That backup is damaged: the availability section is missing.' };
  }

  const when = file.exportedAt ? new Date(file.exportedAt) : null;
  const dated = when && !Number.isNaN(when.getTime())
    ? ` from ${when.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : '';

  return {
    ok: true,
    state,
    summary:
      `Loaded a backup${dated}: ${state.commitments.length} weekly commitments, ` +
      `${state.assignments.length} assignments, ${state.events.length} events, ` +
      `${state.blocks.length} blocks.`,
  };
}
