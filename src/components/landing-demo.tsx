/**
 * The landing page's live demo: a week filling itself in. Classes land first,
 * then study blocks drop into the gaps one by one, and Heron explains one of
 * them. Pure CSS, looping every ten seconds; still under reduced motion.
 *
 * The courses are a real UW engineering student's (Brydon's), anonymised to
 * course codes, so the week looks like a week and not a template.
 */

type Kind = 'cls' | 'a' | 'b' | 'c' | 'goal' | 'run';
const LOOK: Record<Kind, { bg: string; edge: string }> = {
  cls: { bg: 'color-mix(in oklab, var(--ink) 7%, var(--surface))', edge: 'var(--border-strong)' },
  a: { bg: 'color-mix(in oklab, var(--cat-deadline-0) 22%, var(--surface))', edge: 'var(--cat-deadline-0)' },
  b: { bg: 'color-mix(in oklab, var(--cat-deadline-1) 22%, var(--surface))', edge: 'var(--cat-deadline-1)' },
  c: { bg: 'color-mix(in oklab, var(--cat-deadline-2) 22%, var(--surface))', edge: 'var(--cat-deadline-2)' },
  goal: { bg: 'color-mix(in oklab, var(--cat-focus-0) 22%, var(--surface))', edge: 'var(--cat-focus-0)' },
  run: { bg: 'color-mix(in oklab, var(--cat-personal-0) 22%, var(--surface))', edge: 'var(--cat-personal-0)' },
};
// [day, start hour after 8am, hours, kind, label, sub]
const BLOCKS: Array<[number, number, number, Kind, string, string]> = [
  [0, 0, 1, 'run', 'Run', '45 min'], [0, 5.5, 0.8, 'cls', 'MATH 224', 'class'], [0, 3, 1, 'a', 'MGMT 305', 'Reading quiz'], [0, 8, 1.5, 'goal', 'FE study', 'Statics'],
  [1, 2.5, 1, 'cls', 'MGMT 305', 'class'], [1, 4.5, 1.8, 'cls', 'E E 454', 'LOW 201'], [1, 11, 1, 'c', 'E E 496', 'Lab 6 report'],
  [2, 0, 1, 'run', 'Run', '45 min'], [2, 1.5, 1, 'b', 'E E 454', 'Homework 9'], [2, 5.5, 0.8, 'cls', 'MATH 224', 'class'], [2, 8, 1.5, 'goal', 'FE study', 'Dynamics'],
  [3, 2.5, 1, 'cls', 'MGMT 305', 'class'], [3, 4.5, 1.8, 'cls', 'E E 454', 'LOW 201'], [3, 9, 1, 'a', 'MGMT 305', 'Case post'],
  [4, 3.5, 1.6, 'cls', 'E E 496', 'ECE 105'], [4, 5.5, 0.8, 'cls', 'MATH 224', 'class'], [4, 0.5, 1, 'b', 'E E 454', 'Problem set'],
  [5, 2, 1, 'run', 'Run', '45 min'], [5, 4, 1.5, 'goal', 'FE study', 'Circuits'],
  [6, 3, 1, 'a', 'MGMT 305', 'Team project'], [6, 6, 1.5, 'goal', 'FE study', 'Review'],
];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOUR = 380 / 12;

export function LandingDemo() {
  return (
    <div aria-hidden className="landing-float relative rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-float sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="font-display text-title font-bold">Your week</span>
        <span className="landing-show text-xs font-semibold text-[var(--cat-personal-0)]">Planned from Canvas</span>
      </div>
      <div className="mb-2 grid grid-cols-7 gap-1.5">
        {DAYS.map((d) => <span key={d} className="text-center text-xs text-[var(--muted)]">{d}</span>)}
      </div>
      <div className="relative grid grid-cols-7 gap-1.5" style={{ height: 380 }}>
        {DAYS.map((_, day) => (
          <div key={day} className="relative rounded-[10px] bg-[var(--bg)]">
            {BLOCKS.map((b, i) => b[0] !== day ? null : (
              <div
                key={i}
                className="landing-blk absolute inset-x-0.5 overflow-hidden rounded-[8px] px-1.5 py-1"
                style={{
                  top: b[1] * HOUR, height: b[2] * HOUR - 3,
                  background: LOOK[b[3]].bg, boxShadow: `inset 2px 0 0 ${LOOK[b[3]].edge}`,
                  animationDelay: `${b[3] === 'cls' ? 0.2 : 2.2 + i * 0.16}s`,
                }}
              >
                <span className="block truncate text-[10px] font-semibold leading-tight">{b[4]}</span>
                <span className="block truncate text-[10px] leading-tight text-[var(--muted)]">{b[5]}</span>
              </div>
            ))}
          </div>
        ))}
        <div className="landing-sweep pointer-events-none absolute -inset-x-1.5 top-0 h-0.5" style={{ background: 'linear-gradient(90deg, transparent, var(--accent), transparent)', boxShadow: '0 0 18px var(--accent)' }} />
      </div>
      <div className="landing-show absolute -right-3 bottom-10 max-w-[230px] rounded-[16px] bg-[var(--ink)] px-4 py-3 text-[var(--bg)] shadow-float sm:-right-6">
        <p className="text-xs font-semibold text-[var(--accent)]">Why Tuesday, 7 PM?</p>
        <p className="mt-1 text-sm leading-snug">Lab 6 is due Friday, and Tuesday evening is your last free hour before it.</p>
      </div>
    </div>
  );
}
