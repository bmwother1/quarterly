'use client';

import { useMemo } from 'react';
import type { Availability, StudyBlock } from '@/lib/types';
import { inferEnergyPattern, durationBias, deadHours, hourStats } from '@/lib/schedule/observed';

const LABEL: Record<string, string> = {
  morning: 'a morning person',
  evening: 'an evening person',
  steady: 'steady through the day',
  bimodal: 'sharp early and late',
};

function hour12(h: number): string {
  if (h === 0) return '12am';
  if (h === 12) return '12pm';
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

/**
 * What your own blocks say about you.
 *
 * Everything here is offered, never applied silently. The app describes
 * behaviour and proposes a change; the student decides. Two reasons that
 * matters: a pattern from thin data is often wrong, and an app that quietly
 * rewrites your settings based on its own reading of you is unsettling even
 * when it's right.
 */
export function Insights({
  blocks, availability, tz, onAdoptPattern,
}: {
  blocks: StudyBlock[];
  availability: Availability;
  tz: string;
  onAdoptPattern: (p: Availability['energy']) => void;
}) {
  const inferred = useMemo(() => inferEnergyPattern(blocks, tz), [blocks, tz]);
  const bias = useMemo(() => durationBias(blocks), [blocks]);
  const dead = useMemo(() => deadHours(blocks, tz), [blocks, tz]);
  const settled = useMemo(
    () => hourStats(blocks, tz).reduce((s, h) => s + h.attempted, 0),
    [blocks, tz],
  );

  if (settled === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Nothing to go on yet. Once you&rsquo;ve marked a few blocks done or skipped, this is where
        the app tells you what your own week says about you.
      </p>
    );
  }

  const items: React.ReactNode[] = [];

  if (inferred && inferred.pattern !== availability.energy) {
    items.push(
      <div key="energy" className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent-soft)] p-4">
        <p className="font-medium">
          Your blocks say you&rsquo;re {LABEL[inferred.pattern]}.
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          You picked &ldquo;{LABEL[availability.energy]}&rdquo; during setup. Based on{' '}
          {inferred.observations} blocks you&rsquo;ve actually finished or skipped, the other one
          fits better.
        </p>
        <button
          onClick={() => onAdoptPattern(inferred.pattern)}
          className="mt-3 rounded-lg bg-[var(--accent)] px-3.5 py-2 text-sm font-medium text-[var(--accent-ink)]"
        >
          Use what I actually do
        </button>
      </div>,
    );
  } else if (inferred) {
    items.push(
      <p key="energy-ok" className="text-sm text-[var(--muted)]">
        Your blocks agree with your setting: {LABEL[inferred.pattern]}. Based on{' '}
        {inferred.observations} finished or skipped blocks.
      </p>,
    );
  }

  for (const b of bias.slice(0, 2)) {
    const plannedH = (b.planned / b.samples / 60).toFixed(1);
    const actualH = (b.actual / b.samples / 60).toFixed(1);
    const longer = b.ratio > 1;
    items.push(
      <p key={`bias-${b.course}`} className="text-sm">
        <span className="font-medium">{b.course}</span>{' '}
        <span className="text-[var(--muted)]">
          takes you about {actualH}h a session, not the {plannedH}h planned. Estimates have been
          adjusted, so future weeks leave {longer ? 'more' : 'less'} room.
        </span>
      </p>,
    );
  }

  if (dead.length > 0) {
    items.push(
      <p key="dead" className="text-sm">
        <span className="font-medium">
          You rarely finish anything at {dead.map(hour12).join(', ')}.
        </span>{' '}
        <span className="text-[var(--muted)]">
          Worth blocking those hours out in your week so nothing gets scheduled there.
        </span>
      </p>,
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        {settled} blocks recorded. Not enough of a pattern yet to say anything useful, and a guess
        from thin data is worse than nothing.
      </p>
    );
  }

  return <div className="space-y-3">{items}</div>;
}
