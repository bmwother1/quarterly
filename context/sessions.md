# Sessions

Newest first. One short entry each — what happened, what changed, what's true now
that wasn't before. Three or four sentences, not a changelog; the changelog is
`git log`.

When this passes ~15 entries, compress the oldest into a single paragraph and
delete them.

---

## 2026-08-18 · Claude Code · Shipped it

From engine to deployed product in one session. Feed route with a hardened URL
guard, onboarding, setup, the calendar grid, check-off, explicit replanning,
persistence. Live at quarterly-alpha.vercel.app, pushed to GitHub, 122 tests.

Almost every bug this session was found by looking at the thing rather than by a
failing test. The scheduler put a run at 11pm and was right by its own model. One
daily ceiling stacked 4.6 hours onto a Tuesday after a nine-hour shift. Setup
silently discarded saved work hours because handlers built updates from stale
render closures. Block ids collided after a replan because the session index
restarts at 1. The calendar never drew the work schedule at all.

Brydon's own week became the fixture, and the off-season case caught a bug four
weeks before a student would have.

## 2026-08-18 · Claude Code · The context system

Built this `context/` system, a `/wrap` skill to maintain it, and `npm run
handoff` to generate a paste-ready brief for Cowork chats. Root `CLAUDE.md`
rewritten as a short always-loaded index that routes to everything else on
demand, so the deep files cost nothing until they're needed.

## 2026-08-18 · Claude Code · Canvas ingestion and the scheduling engine

Installed Node (user-local, no sudo — the machine had none), scaffolded Next.js,
and built the entire domain layer: ICS parser, Canvas interpretation, and the
scheduler. 66 tests, all green, plus a terminal preview that prints a real week.

Two things were found by building that no amount of planning would have caught.
The energy-fit feature was structurally inert — it passed every test and did
nothing, because slots were picking tasks rather than tasks picking slots. And
the first honest preview was 90% past-due work, because overdue Canvas items
score maximum urgency and the feed never says what was submitted. Both are fixed
and both are written up in `learned.md`.

Also confirmed Brydon was right that the six-week plan padded week 1. Node took
three minutes. The parts that genuinely can't compress are the ones that depend
on other people.

## 2026-08-17 · Cowork · Research and planning

Competitive research across twelve competitors, then a business plan, competitor
analysis, build roadmap, pitch deck, dashboard, week-1 playbook, and interview
tracker. Three findings reshaped the plan: the Canvas calendar feed removes the
integration problem entirely, the classroom evidence for spaced retrieval is far
weaker than the lab evidence so grade claims are off the table, and the scheduler
should be deterministic code rather than an LLM call.

Deliverables live in `~/Downloads/Quarterly_*`.
