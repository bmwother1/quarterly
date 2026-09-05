# Heron

A study scheduler for university students. Reads your Canvas deadlines, learns
when you actually have time, and lays out a week of study blocks that adapt when
you fall behind.

Built for UW first. Free for students.

---

## Running it

Node 24+ is required — it runs TypeScript directly, which is why there's no
build step or test framework in the domain layer.

```bash
npm install
npm run dev          # the web app, http://localhost:3000
npm test             # 66 tests, no framework, ~700ms
npm run check        # typecheck + lint + tests
```

Two terminal tools for working on the scheduler without a browser:

```bash
npm run week                              # plan a week from the sample feed
npm run week -- --busy --energy evening   # with classes, for an evening person
npm run week -- <your-canvas-feed>.ics    # against your own data
```

`npm run week` is the fastest way to see whether a change to the scoring weights
produced a week a real person would actually follow. Read the output, not the
tests.

---

## Getting your Canvas feed

Canvas → **Calendar** → **Calendar Feed** in the right sidebar → copy the URL.

No OAuth, no institutional approval, no credentials. It's a plain iCal feed of
your assignments and due dates.

> **Treat that URL like a password.** Anyone holding it can see your whole
> schedule. It never goes in a repo, a screenshot, or a group chat.

Between quarters the feed is often empty — Canvas only carries 30 days back and
366 forward. Use `fixtures/sample-feed-midquarter.ics` to see a full quarter.

---

## How it's put together

```
src/lib/
  types.ts              domain model — everything the scheduler touches
  time.ts               timezone arithmetic; the only place local↔instant happens
  canvas/ics.ts         dependency-free iCalendar parser
  canvas/interpret.ts   Canvas semantics: courses, work types, durations, weights
  schedule/score.ts     the scoring function and study-method selection
  schedule/slots.ts     free-time discovery from a weekly availability pattern
  schedule/plan.ts      the planner
```

The domain layer has no dependencies and no React. It runs in the terminal, in
tests, and in the browser unchanged.

### Three decisions worth knowing about

**The scheduler is not an LLM call.** It's a scoring function and a greedy
assignment pass. LLMs are bad at constraint satisfaction, cost money per run, and
are non-deterministic — meaning the schedule reshuffles for no reason and
students stop trusting it. Planning a full quarter takes about 20ms. The LLM's
job is syllabus parsing, not scheduling.

**Tasks pick slots, not the other way round.** The obvious implementation walks
time forward and drops in whatever scores highest at each opening. It's simpler,
and it quietly guts the product: the energy-fit term can then only break ties,
never move work to a better hour, so a student who says they're useless before
noon still gets exam prep at 8am. Work is ranked first by everything that doesn't
depend on timing, then each piece picks the best hour still open to it.

**It refuses to lie about capacity.** Work that doesn't fit comes back in
`unscheduled` with a reason. Deadlines that already passed come back in `overdue`
rather than being scheduled at maximum urgency — a Canvas feed carries a month of
history and never says what was submitted. Silently overbooking a student is the
exact thing that gets a planner deleted in week 4.

### The scoring function

```
score = urgency × weight × spacing × (1/confidence)     ← ranks the work
value = fit / (1 + days × earlyBias)                    ← picks the hour
```

Every term is bounded. An unbounded `1/confidence` means one assignment marked
shaky swamps five real deadlines and the schedule stops looking sane. Legibility
matters more than optimality here: a student who can't see why a block is there
won't follow it.

Each block carries a generated one-line explanation built from whichever term
actually dominated — a real account of the ranking, not decoration.

---

## Status

Done: Canvas ingestion, the scheduling engine, terminal tooling, 66 tests.

Next: the feed proxy route, onboarding, the availability grid, the week view,
local-first persistence, deploy.
