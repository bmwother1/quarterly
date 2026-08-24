# Sessions

Newest first. One short entry each — what happened, what changed, what's true now
that wasn't before. Three or four sentences, not a changelog; the changelog is
`git log`.

When this passes ~15 entries, compress the oldest into a single paragraph and
delete them.

---

## 2026-08-23 · Claude Code · The data layer, and a bug a student would have found

Supabase went in: schema, magic-link auth, plan sync, and the telemetry that
week-4 retention is measured from. Nothing in the product requires an account
and nothing does now; every path treats signed-out as "stay local", so the
no-account product is exactly what it was.

Two bugs in it were the interesting part. The Supabase client is created lazily,
so when a magic link landed on `/week` and nothing on that page touched
Supabase, no client existed, the code in the URL was never exchanged, and the
sign-in silently did nothing while looking identical to success. And
`lastSyncedAt` was doing double duty as "does this device have unsynced edits",
which made a device that had never synced read as infinitely old, so a week
built offline lost to any server copy without a word.

Then Brydon looked at his own calendar and found the real one: a 5-a-week run
and a 4-a-week project were both landing seven times, on every single day.
Sessions carried a deadline and no floor, so the early-bias in slot value
dragged later weeks forward. Fixing placement exposed a second bug underneath
it, where the reason text said "6 of 5 this week" because it counted across the
whole plan rather than within a week.

Neither was found by a test. Both were found by reading real output, which is
now four sessions running.

Ended with 198 tests and a live product with accounts. The sync loop has still
never been watched end to end by anyone, because the magic link goes to an inbox
no agent can reach.

## 2026-08-22 · Claude Code · Onboarding got an ending

Wired up the completion model that had sat in the repo for three days as a
module no page imported, so it did nothing at all. The `/week` banner that could
only say one thing and had no way to be answered is gone, replaced by one prompt
at a time that a student can answer in either direction. The app now has a real
notion of **live**: once every required step is resolved the prompts stop
permanently, including for someone who later deletes every commitment.

Built `/onboarding`, a five-step guided flow on the `OnboardingShell` component
that was written last week and never used. `/start` keeps its two questions and
stays the default door; this is the other one.

The session started on the business plan that was owed, and turned into code
halfway through when a mentor's input arrived. The mentor asked for a signup
flow first and a calendar flow second; the signup half was pushed back on and
built last instead, as a labelled mock, because there are no accounts until
Supabase lands and putting an identity wall in front of a three-second first run
trades away the best-measured thing this product has.

One bug found by looking rather than by a test, again: `autoFocus` scrolled the
page 302px on load, so a student on a phone landed mid-form having never seen
the heading or the progress bar.

## 2026-08-21 · Claude Code · Import anything, and a day view

Four things landed. Two bugs in the first-run path, found by writing a script
that prints what a stranger actually gets from `/start` — one of which silently
stopped a commitment being scheduled forever after a single shortfall. Conflict
resolution, so an appointment dropped on planned work moves the work and says so.
A day view, whose palette work turned up that the course colours failed a
colourblind check. And calendar import for Canvas, Google, Apple and Outlook,
which needed recurrence expansion to be worth anything.

Two roadmap items were struck on evidence: Google's calendar API needs a
five-week verification, and writing a plan back into Google Calendar is worse
than nothing because subscriptions refresh every 12–24 hours.

Also found Canvas had become unreachable on a phone — the tab bar dropped it on
the reasoning that it belonged inside Plan, and it was never put inside Plan. A
commit message that was true about intent and false about the code.

Ended with a business-side action plan requested and not delivered. It is
recorded at the top of the owed section in `status.md`.

## 2026-08-19 · Claude Code · Landing page, privacy, and a deployment mess

Replaced the entry point. It opened with "paste your Canvas feed" in August,
when every student's feed is empty by construction, and never mentioned the mode
that actually works. Canvas moved to /canvas, landing leads with building a week
by hand. Added navigation, which was missing entirely, and a privacy page
written against the code rather than aspirationally.

Writing the privacy page caught two false claims: a delete control that didn't
exist, and a source link on a private repo. Both fixed rather than softened.

Deployment turned out to be broken in a way the success messages hid. The shared
URL belongs to a project with no Git connection, so five pushes never deployed. A
CLI deploy created a second project, which is behind Vercel SSO and invisible to
anyone but Brydon. Neither failure announced itself.

First interview happened. Logged as zero signal, with the reasons.

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
