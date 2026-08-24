'use client';

/**
 * A miniature week, drawn from real block shapes rather than an illustration.
 *
 * This exists because of one piece of feedback: people hear the pitch and say
 * "doesn't Outlook do this?". They are not being obtuse. The words for "calendar
 * app" and "thing that decides your week" are the same words, so anyone hearing
 * a description maps it onto the nearest tool they already know. A drawing of a
 * calendar makes that worse, because a drawing of a calendar is what Outlook
 * looks like.
 *
 * **Why blocks are positioned across the whole grid rather than inside day
 * columns.** A block nested in Tuesday's column can never animate to Thursday;
 * the best it can do is disappear and reappear, which reads as the plan being
 * replaced. Absolute positioning over one container means the same DOM node
 * moves, and *watching work slide to another day* is the entire argument. It is
 * the one thing a calendar app structurally cannot show, because a calendar has
 * no idea what should have happened.
 *
 * Identity is what makes that work: a block keeps its `id` across states, so
 * React keeps the element and CSS interpolates the change.
 */

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export interface SketchBlock {
  /** Stable across states. The same id in two states is the same block moving. */
  id: string;
  /** 0 = Monday. */
  day: number;
  /** Fraction down the column, 0 to 1. */
  top: number;
  /** Fraction of column height. */
  height: number;
  tone: 'work' | 'study' | 'fixed';
  /** Struck through: time that passed without an answer. */
  missed?: boolean;
}

const TONE: Record<SketchBlock['tone'], string> = {
  study: 'var(--accent)',
  work: '#0ea5e9',
  fixed: 'var(--border-strong)',
};

export function WeekSketch({ blocks }: { blocks: SketchBlock[] }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3" aria-hidden>
      <div className="mb-1.5 grid grid-cols-7 gap-1 text-center text-[10px] text-[var(--faint)]">
        {DAYS.map((d, i) => <span key={i}>{d}</span>)}
      </div>

      {/* The columns are scenery. Everything that moves lives in the overlay. */}
      <div className="relative h-36">
        <div className="absolute inset-0 grid grid-cols-7 gap-1">
          {DAYS.map((_, i) => <div key={i} className="rounded bg-[var(--raised)]" />)}
        </div>

        {blocks.map((b) => (
          <div
            key={b.id}
            className="sketch-block absolute rounded-[3px]"
            style={{
              left: `calc(${(b.day * 100) / 7}% + 3px)`,
              width: `calc(${100 / 7}% - 6px)`,
              top: `${b.top * 100}%`,
              height: `${b.height * 100}%`,
              background: TONE[b.tone],
              opacity: b.missed ? 0.25 : 0.92,
            }}
          >
            {b.missed && (
              <span
                className="absolute left-1/2 top-1/2 h-[1.5px] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded"
                style={{ background: 'var(--warn)' }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A week as first planned. Fixed time first, study fitted around it.
 *
 * `s2` and `s3` are the two that will move. Everything else stays put, which is
 * what makes the movement legible: if the whole grid rearranged, it would read
 * as a different week rather than as the same week repaired.
 */
export const PLANNED: SketchBlock[] = [
  { id: 'f0', day: 0, top: 0.10, height: 0.34, tone: 'fixed' },
  { id: 'f2', day: 2, top: 0.10, height: 0.34, tone: 'fixed' },
  { id: 'f4', day: 4, top: 0.10, height: 0.34, tone: 'fixed' },
  { id: 's1', day: 0, top: 0.56, height: 0.18, tone: 'study' },
  { id: 's2', day: 1, top: 0.20, height: 0.22, tone: 'study' },
  { id: 'w1', day: 1, top: 0.62, height: 0.14, tone: 'work' },
  { id: 's3', day: 2, top: 0.56, height: 0.18, tone: 'study' },
  { id: 's4', day: 3, top: 0.20, height: 0.26, tone: 'study' },
  { id: 'w2', day: 3, top: 0.62, height: 0.14, tone: 'work' },
  { id: 'w3', day: 4, top: 0.56, height: 0.14, tone: 'work' },
  { id: 's5', day: 5, top: 0.28, height: 0.20, tone: 'study' },
];

/** Tuesday and Wednesday went by. Same blocks, same places, struck through. */
export const MISSED: SketchBlock[] = PLANNED.map((b) =>
  (b.day === 1 || b.day === 2) && b.tone !== 'fixed' ? { ...b, missed: true } : b,
);

/**
 * Rebuilt. `s2`, `s3` and `w1` keep their ids and take new days, so they travel
 * rather than vanishing. The fixed blocks never move, because they are the
 * things the scheduler is not allowed to touch.
 */
export const REBUILT: SketchBlock[] = [
  { id: 'f0', day: 0, top: 0.10, height: 0.34, tone: 'fixed' },
  { id: 'f2', day: 2, top: 0.10, height: 0.34, tone: 'fixed' },
  { id: 'f4', day: 4, top: 0.10, height: 0.34, tone: 'fixed' },
  { id: 's1', day: 0, top: 0.56, height: 0.18, tone: 'study' },
  { id: 's4', day: 3, top: 0.16, height: 0.26, tone: 'study' },
  { id: 'w2', day: 3, top: 0.62, height: 0.14, tone: 'work' },
  { id: 's2', day: 3, top: 0.46, height: 0.14, tone: 'study' },
  { id: 'w3', day: 4, top: 0.56, height: 0.14, tone: 'work' },
  { id: 's3', day: 4, top: 0.74, height: 0.18, tone: 'study' },
  { id: 's5', day: 5, top: 0.20, height: 0.20, tone: 'study' },
  { id: 'w1', day: 5, top: 0.50, height: 0.14, tone: 'work' },
];
