# Status

**Updated: 2026-08-19** · 42 days to launch (September 30)

This file describes the present. It gets rewritten, not appended to.

Repo: `bmwother1/quarterly` (**public**). Live and current at
`quarterly-alpha.vercel.app`. Pushes to `main` auto-deploy.

---

## Right now

The product is built and works. Engine, interface, deployment, privacy page,
122 tests. A student can describe their week or connect Canvas, get a real plan
as a calendar, check blocks off, and replan around what actually happened.

Two things are not true yet, and both matter more than anything on the Shipped
list:

1. **Nobody has used it.** One interview, logged honestly as zero signal.
2. **Nothing measures retention**, which is the number that decides the project.

## Shipped

- **Scheduling engine** — scoring function, free-time discovery, constraint-aware
  placement, generated per-block explanations, honest reporting of what didn't
  fit. ~21ms for a full quarter, deterministic
- **Canvas ingestion** — dependency-free iCal parser handling all three timestamp
  shapes including floating times across DST; classification, durations, weights
- **Recurring commitments** — weekly quotas with no deadline, so it works outside
  a quarter. This is what makes the product usable in August
- **Feed route** — server-side fetch, host allowlist, private-range refusal,
  redirects off, size cap, timeout, URL never logged or stored
- **Interface** — landing, Canvas intake with workload chart, setup, calendar
  grid with busy time drawn in, check-off, explicit replanning
- **Privacy page** written against the code, with a working delete control
- **Persistence** — localStorage behind an interface, no signup

## Next, in order

1. **Nineteen more interviews.** Nothing else on this list matters as much.
2. **Use it himself for a full week.** The closest available proxy for retention.
3. **Supabase** — sync, and the usage data that week-4 retention needs.
4. **Syllabus parsing** — the one job an LLM genuinely belongs in.
5. Tailwind build oddity: `max-w-*` utilities produced no CSS, so the calendar
   width is set inline. It will bite again on a class that matters more.

## Blocked on Brydon

- **Deployment Protection** is still on, so the `*-bmwother1s-projects.vercel.app`
  URLs redirect to a Vercel login. `quarterly-alpha.vercel.app` is unaffected and
  is the one to share, but turn protection off to avoid confusing yourself later.
- **The interviews.** Ask what they did last Sunday. Don't show the product.
- **Use it for a week.**

## Open questions

- Would a student who connected in week 0, saw an empty feed, and set up their
  week by hand come back when the quarter starts?
- Does anyone outside this project describe the 9pm decision problem unprompted?
- What is the business model? Free for students is the acquisition strategy, not
  a revenue plan, and nothing has been decided beyond that.
