'use client';

import { useState } from 'react';
import type { StudyBlock } from '@/lib/types';
import { fmtTime } from '@/lib/time';
import type { Completion } from '@/lib/schedule/complete';

/**
 * One study block.
 *
 * The "why" line is the thing that distinguishes this from a to-do list, so it
 * stays visible rather than hiding behind a tap. A student who can't see why a
 * block is there won't do it.
 */
export function BlockCard({
  block, tz, colour, onComplete, isPast,
}: {
  block: StudyBlock;
  tz: string;
  colour: string;
  onComplete: (outcome: Completion, minutes: number | null) => void;
  isPast: boolean;
}) {
  const [askingPartial, setAskingPartial] = useState(false);
  const [partialMinutes, setPartialMinutes] = useState(String(Math.round(block.minutes / 2)));

  const settled = block.status !== 'planned';

  return (
    <div
      className={`rounded-lg border p-3 transition-opacity ${
        settled ? 'opacity-55' : ''
      } ${isPast && !settled ? 'border-[var(--warn)]/50' : 'border-[var(--border)]'} bg-[var(--surface)]`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colour }} aria-hidden />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="tabular-nums text-sm text-[var(--muted)]">
              {fmtTime(block.start, tz)}–{fmtTime(block.end, tz)}
            </span>
            <span className="text-xs text-[var(--faint)]">{block.minutes} min</span>
            {block.sessionCount > 1 && (
              <span className="text-xs text-[var(--faint)]">
                {block.sessionIndex} of {block.sessionCount}
              </span>
            )}
          </div>

          <p className={`mt-0.5 font-medium ${settled ? 'line-through decoration-[var(--faint)]' : ''}`}>
            {block.course === block.title ? block.title : `${block.course} · ${block.title}`}
          </p>

          {block.method !== 'work session' && (
            <p className="mt-0.5 text-xs uppercase tracking-wide text-[var(--faint)]">{block.method}</p>
          )}
          <p className="mt-1.5 text-sm text-[var(--muted)]">{block.why}</p>

          {settled ? (
            <p className="mt-2 text-xs text-[var(--faint)]">
              {block.status === 'done' && `Done · ${block.actualMinutes ?? block.minutes} min logged`}
              {block.status === 'partial' && `Partial · ${block.actualMinutes ?? 0} min logged`}
              {block.status === 'skipped' && 'Skipped'}
            </p>
          ) : askingPartial ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="text-sm text-[var(--muted)]">
                Minutes actually spent
                <input
                  type="number"
                  min={1}
                  max={600}
                  value={partialMinutes}
                  onChange={(e) => setPartialMinutes(e.target.value)}
                  className="ml-2 w-20 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm"
                />
              </label>
              <button
                onClick={() => {
                  const n = Number(partialMinutes);
                  onComplete('partial', Number.isFinite(n) && n > 0 ? n : block.minutes);
                  setAskingPartial(false);
                }}
                className="rounded border border-[var(--border)] px-2.5 py-1 text-sm"
              >
                Log it
              </button>
              <button
                onClick={() => setAskingPartial(false)}
                className="text-sm text-[var(--faint)] underline underline-offset-4"
              >
                cancel
              </button>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                onClick={() => onComplete('done', block.minutes)}
                className="rounded bg-[var(--accent)] px-2.5 py-1 text-sm font-medium text-white"
              >
                Done
              </button>
              <button
                onClick={() => setAskingPartial(true)}
                className="rounded border border-[var(--border)] px-2.5 py-1 text-sm"
              >
                Partly
              </button>
              <button
                onClick={() => onComplete('skipped', null)}
                className="rounded px-2.5 py-1 text-sm text-[var(--muted)]"
              >
                Skipped
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
