'use client';

import Link from 'next/link';

/**
 * The frame every onboarding screen sits in.
 *
 * Three things it guarantees, which the old single-screen `/start` did not:
 * you can always see how far through you are, you can always leave, and every
 * step can be answered in both directions. A flow you can't decline is a flow
 * people abandon rather than finish.
 */
export function OnboardingShell({
  stepNumber, stepCount, title, blurb, onSkip, skipLabel, children, footer,
}: {
  stepNumber: number;
  stepCount: number;
  title: string;
  blurb: string;
  onSkip?: () => void;
  skipLabel?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const pct = Math.round((stepNumber / (stepCount + 1)) * 100);

  return (
    <main className="mx-auto max-w-lg px-5 pb-24 pt-8 sm:pt-16">
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between text-sm text-[var(--muted)]">
          <span>
            Step {stepNumber} of {stepCount}
          </span>
          <Link href="/week" className="-mr-3 btn-quiet">
            Finish later
          </Link>
        </div>
        <div
          className="h-1 w-full overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]"
          role="progressbar"
          aria-valuenow={stepNumber}
          aria-valuemin={0}
          aria-valuemax={stepCount}
          aria-label="Setup progress"
        >
          <div
            className="h-full rounded-full bg-[var(--accent)]"
            style={{ width: `${pct}%`, transition: 'width var(--dur-move) var(--ease)' }}
          />
        </div>
      </div>

      {/* Keyed on the step, so each question arrives rather than swapping in. */}
      <div key={stepNumber}>
        <h1 className="enter text-heading font-semibold">{title}</h1>
        <p className="enter mt-2 text-base text-[var(--muted)]" style={{ '--i': 1 } as React.CSSProperties}>{blurb}</p>

        <div className="enter mt-8" style={{ '--i': 2 } as React.CSSProperties}>{children}</div>
      </div>

      {(footer || onSkip) && (
        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-center">
          {footer}
          {onSkip && (
            <button onClick={onSkip} className="btn-quiet">
              {skipLabel ?? 'Skip'}
            </button>
          )}
        </div>
      )}
    </main>
  );
}

/** The primary action. One per screen — more than one is a decision, not a step. */
export function Continue({
  onClick, disabled, children = 'Continue',
}: {
  onClick: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="btn-primary btn-lg w-full sm:w-auto sm:px-8"
    >
      {children}
    </button>
  );
}
