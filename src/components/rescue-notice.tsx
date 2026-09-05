'use client';

import { useState } from 'react';
import { heronStore } from '@/lib/store';
import { fmtDay } from '@/lib/time';

/**
 * "Your week was replaced by your account. Want the other one back?"
 *
 * Only appears when a sync actually overwrote something, which should be rare
 * and, on the evidence of the last two days, is not rare enough. A rescue copy
 * nobody can reach is not a rescue.
 *
 * The count is the whole message. "Replaced 14 blocks with 3" tells a student
 * instantly whether the right copy won, without asking them to compare two
 * calendars from memory.
 */
export function RescueNotice({ tz }: { tz: string }) {
  const [dismissed, setDismissed] = useState(false);
  const held = dismissed ? null : heronStore.stashed();

  if (!held) return null;

  const current = heronStore.getSnapshot();
  const before = held.state.commitments.length
    + held.state.availability.busy.filter((b) => b.kind !== 'sleep').length;
  const now = current.commitments.length
    + current.availability.busy.filter((b) => b.kind !== 'sleep').length;

  // Nothing was really lost. Saying so would be alarming for no reason.
  if (before <= now) return null;

  return (
    <div className="mb-6 rounded-xl border border-[var(--warn)]/40 bg-[var(--accent-soft)] p-4">
      <h2 className="font-medium text-[var(--warn)]">Your account replaced what was on this device.</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        The copy from {fmtDay(held.at, tz)} had {before} things set up. This one has {now}.
        If that is the wrong way round, put the other one back.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={() => { heronStore.restoreStash(); heronStore.discardStash(); setDismissed(true); }}
          className="rounded-lg bg-[var(--accent)] px-3.5 py-2 text-sm font-medium text-[var(--accent-ink)]"
        >
          Put the other one back
        </button>
        <button
          onClick={() => { heronStore.discardStash(); setDismissed(true); }}
          className="text-sm text-[var(--muted)] underline underline-offset-4"
        >
          This one is right
        </button>
      </div>
    </div>
  );
}
