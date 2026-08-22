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
    <main className="mx-auto max-w-lg px-5 pb-24 pt-10 sm:pt-16">
      <div className="mb-8">
        <div className="mb-2 flex items-baseline justify-between text-xs text-[var(--faint)]">
          <span className="font-medium tracking-wide">
            Step {stepNumber} of {stepCount}
          </span>
          <Link href="/week" className="underline underline-offset-4 hover:text-[var(--muted)]">
            Finish later
          </Link>
        </div>
        <div
          className="h-1 w-full overflow-hidden rounded-full bg-[var(--border)]"
          role="progressbar"
          aria-valuenow={stepNumber}
          aria-valuemin={0}
          aria-valuemax={stepCount}
          aria-label="Setup progress"
        >
          <div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <h1 className="rise text-[1.75rem] font-semibold leading-tight sm:text-[2.1rem]">{title}</h1>
      <p className="rise mt-2.5 text-[var(--muted)]">{blurb}</p>

      <div className="rise mt-7">{children}</div>

      {(footer || onSkip) && (
        <div className="mt-6 flex flex-wrap items-center gap-4">
          {footer}
          {onSkip && (
            <button
              onClick={onSkip}
              className="text-sm text-[var(--muted)] underline underline-offset-4 hover:text-[var(--ink)]"
            >
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
      className="w-full rounded-xl bg-[var(--accent)] px-5 py-3.5 font-medium text-[var(--accent-ink)] shadow-[var(--shadow-md)] transition-transform active:scale-[0.98] disabled:bg-transparent disabled:text-[var(--faint)] disabled:shadow-none disabled:ring-1 disabled:ring-[var(--border)] sm:w-auto sm:px-8"
    >
      {children}
    </button>
  );
}
