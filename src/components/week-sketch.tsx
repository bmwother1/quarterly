'use client';

/**
 * A miniature week, drawn from real block shapes rather than an illustration.
 *
 * This exists because of one piece of feedback: people hear the pitch and say
 * "doesn't Outlook do this?". They are not being obtuse. The words for "calendar
 * app" and "thing that decides your week" are the same words, so anyone hearing
 * a description maps it onto the nearest tool they already know.
 *
 * A drawing of a calendar makes that worse, because a drawing of a calendar is
 * what Outlook looks like. What breaks the mapping is seeing work placed into
 * hours nobody typed, and then seeing it move. So these are real proportions on
 * a real grid, deliberately too small to read as an interface and large enough
 * to read as a decision.
 */

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export interface SketchBlock {
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

export function WeekSketch({ blocks, dim = false }: { blocks: SketchBlock[]; dim?: boolean }) {
  return (
    <div
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
      aria-hidden
    >
      <div className="mb-1.5 grid grid-cols-7 gap-1 text-center text-[10px] text-[var(--faint)]">
        {DAYS.map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="grid h-36 grid-cols-7 gap-1">
        {DAYS.map((_, day) => (
          <div key={day} className="relative rounded bg-[var(--raised)]">
            {blocks.filter((b) => b.day === day).map((b, i) => (
              <div
                key={i}
                className="absolute inset-x-[2px] rounded-[3px] transition-all duration-500"
                style={{
                  top: `${b.top * 100}%`,
                  height: `${b.height * 100}%`,
                  background: TONE[b.tone],
                  opacity: b.missed ? 0.28 : dim ? 0.5 : 0.92,
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
        ))}
      </div>
    </div>
  );
}

/** A week as first planned. Work shifts fixed, study fitted around them. */
export const PLANNED: SketchBlock[] = [
  { day: 0, top: 0.10, height: 0.34, tone: 'fixed' },
  { day: 2, top: 0.10, height: 0.34, tone: 'fixed' },
  { day: 4, top: 0.10, height: 0.34, tone: 'fixed' },
  { day: 0, top: 0.56, height: 0.18, tone: 'study' },
  { day: 1, top: 0.20, height: 0.22, tone: 'study' },
  { day: 1, top: 0.62, height: 0.14, tone: 'work' },
  { day: 2, top: 0.56, height: 0.18, tone: 'study' },
  { day: 3, top: 0.20, height: 0.26, tone: 'study' },
  { day: 3, top: 0.62, height: 0.14, tone: 'work' },
  { day: 4, top: 0.56, height: 0.14, tone: 'work' },
  { day: 5, top: 0.28, height: 0.20, tone: 'study' },
];

/** The same week after two days went by unanswered. */
export const MISSED: SketchBlock[] = PLANNED.map((b) =>
  (b.day === 1 || b.day === 2) && b.tone !== 'fixed' ? { ...b, missed: true } : b,
);

/** Rebuilt: the missed work reappears later in the week, around what is fixed. */
export const REBUILT: SketchBlock[] = [
  ...PLANNED.filter((b) => b.tone === 'fixed'),
  { day: 0, top: 0.56, height: 0.18, tone: 'study' },
  { day: 3, top: 0.18, height: 0.26, tone: 'study' },
  { day: 3, top: 0.50, height: 0.16, tone: 'study' },
  { day: 4, top: 0.50, height: 0.20, tone: 'study' },
  { day: 5, top: 0.16, height: 0.24, tone: 'study' },
  { day: 5, top: 0.46, height: 0.18, tone: 'work' },
  { day: 6, top: 0.22, height: 0.22, tone: 'study' },
  { day: 6, top: 0.50, height: 0.16, tone: 'work' },
];
