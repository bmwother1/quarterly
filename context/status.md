# Status

**Updated: 2026-08-18** · 43 days to launch (September 30)

This file describes the present. It gets rewritten, not appended to.

**Live at https://quarterly-alpha.vercel.app** — every push to `main` deploys.
Repo: `bmwother1/quarterly` (private).

---

## Right now

The product works end to end and is deployed. A student can connect Canvas or
describe their week by hand, get a planned week as a calendar, check blocks off,
and replan around what they actually did.

Zero student interviews. That is still the largest risk on the board and no
amount of building reduces it.

## Shipped

- **Canvas ingestion** — dependency-free iCal parser handling all three
  timestamp shapes including floating times across a DST boundary; course
  extraction, work classification, seed durations and grade weights
- **Scheduling engine** — scoring function, free-time discovery, greedy
  placement under real constraints, generated per-block explanations, honest
  reporting of what didn't fit. ~21ms for a full quarter, deterministic
- **Recurring commitments** — weekly quotas with no deadline, so the app works
  outside a quarter. Hard constraints (time windows, session minimums, trailing
  buffers) sit outside the scoring function as filters
- **Feed route** — server-side fetch with a host allowlist, private-range
  refusal, redirects off, size cap and timeout. Never logs or stores the URL
- **Onboarding, setup and week view** — Canvas intake with the workload chart,
  availability and commitments editor, calendar grid with busy time drawn in,
  check-off, explicit replanning
- **Persistence** — localStorage behind an interface, no signup
- **122 tests**, clean typecheck, lint and production build

## Next, in order

1. **Twenty interviews.** Nothing else on this list matters as much.
2. **Privacy page.** Plain English. Required before showing this to students,
   since the landing page makes a claim about the feed URL with nothing behind it.
3. **Supabase.** Cross-device sync and, more importantly, the usage data that
   week-4 retention depends on. Decision below is now settled in favour.
4. **Syllabus parsing** — the one job an LLM genuinely belongs in.
5. **Tailwind build oddity** — `max-w-5xl` and `max-w-[1080px]` both produced no
   CSS, so the calendar width is set inline. Works, but it will bite again on a
   class that matters more.

## Blocked on Brydon

- **Twenty interviews.** Run them in parallel with everything else.
- **Use it for a week.** The off-season case is real now. Whether *you* still
  open it on day five is the closest available proxy for week-4 retention.

## Open questions

- Would a student who connected in week 0 and saw an empty quarter come back?
- Nothing in the product has been seen by a student yet.
