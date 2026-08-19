# Status

**Updated: 2026-08-19** · 42 days to launch (September 30)

This file describes the present. It gets rewritten, not appended to.

Repo: `bmwother1/quarterly` (private). Deployment needs attention, see below.

---

## Right now

The product works end to end. A student can describe their week, or connect
Canvas, get a plan as a calendar, check blocks off, and replan around what they
actually did. Built, tested, and running.

Two things are not done: the deployment is in a broken half-state, and there is
essentially no evidence from real students.

## Shipped

- **Canvas ingestion** — dependency-free iCal parser handling all three
  timestamp shapes including floating times across a DST boundary
- **Scheduling engine** — scoring function, free-time discovery, greedy
  placement under real constraints, per-block explanations, honest reporting of
  what didn't fit. ~21ms for a full quarter, deterministic
- **Recurring commitments** — weekly quotas with no deadline, so it works
  outside a quarter. Hard constraints sit outside the scoring function as filters
- **Feed route** — server-side fetch, host allowlist, private-range refusal,
  redirects off, size cap, timeout. Never logs or stores the URL
- **Landing, Canvas intake, setup, week view, privacy** — calendar grid with
  busy time drawn in, check-off, explicit replanning, delete-my-data
- **Persistence** — localStorage behind an interface, no signup
- **122 tests**, clean typecheck, lint and production build

## Broken or unfinished

- **Deployment is split across two Vercel projects.** `quarterly-alpha` is the
  URL that was shared but has no Git connection, so five pushes never deployed
  and it still serves an old commit. A second project `quarterly` was created by
  the CLI, has current code, and is behind Vercel SSO so nobody can view it.
  Fix: connect `quarterly-alpha` to the repo, delete the stray project, confirm
  Deployment Protection is off.
- **Tailwind build oddity** — `max-w-5xl` and arbitrary values produced no CSS,
  so the calendar width is set inline. Works, will bite again.

## Next, in order

1. **Fix the deployment.** One project, Git-connected, publicly reachable.
2. **Nineteen more interviews.** Nothing else on this list matters as much.
3. **Use it yourself for a week.** Closest available proxy for week-4 retention.
4. **Supabase.** Cross-device sync, and the usage data retention depends on.
5. **Syllabus parsing** — the one job an LLM genuinely belongs in.

## Evidence from students

**1 of 20 interviews.** See `learned.md`. The one conversation produced no
usable signal, for reasons recorded there.
