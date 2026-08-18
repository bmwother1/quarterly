# Quarterly — project brief

*Generated 2026-08-18 from the project's `context/` files by `npm run handoff`.
Don't edit this by hand; edit the source files and regenerate.*

This is the standing context for Quarterly. It covers the person building it,
what's being built, where it stands, and what has already been decided — so a
conversation can start from here instead of from scratch.

**43 days to launch** (September 30 2026).

---

# Who you're working with

> **Correct anything wrong here.** This file shapes every conversation, so an
> error in it is expensive and a fix is cheap. Parts of it are inferred from the
> machine and from how past sessions went, and inference is not knowledge.

## The short version

UW student in Seattle, building Quarterly — a study scheduler for students —
solo, AI-assisted, against a September 30 2026 launch. Budget $500–$5,000 for six
months. First-time founder.

## What he can actually build

More than "non-technical," which is how the early planning documents framed it
and which undersells him.

Evidence on the machine: a Python prediction-market trading bot with a real
structure (feature engineering, a price feed, an outcome tracker, a notifier);
Verilog labs (FSMs, DE1-SoC); Arduino/C++ motor control and line following; R;
Java from CSE coursework. Coursework spans CSE 121/122, EE 351, power
electronics, MATH 124, CHEM 142/152, PHYS 114, ACCTG 219, ENGL 131. Reads like
electrical engineering with a real programming spine.

What that means in practice:

- **Not new to code.** Don't explain what a function is, what a loop does, or why
  tests exist.
- **New to the JavaScript world.** Before this project the machine had no Node,
  no npm, no Homebrew. React, Next.js, the package ecosystem, and deployment are
  genuinely unfamiliar. Explain those.
- **Comfortable with systems thinking.** Scheduling as a constraint problem, a
  scoring function, feedback from observed data — these land without preamble.

## How to work with him

**Be direct and cut the padding.** The single most useful correction he's given
so far: told that week 1 was mostly setup, he said he didn't see installing Node
taking a week. He was right, it took three minutes, and the plan was padded.
Estimate honestly and revise out loud when the estimate was wrong.

**Lead with the recommendation.** He asks "what are your thoughts on how I should
proceed" and wants an answer, not a menu. Give the call, give the reasoning in a
sentence or two, then move.

**Show the thing rather than describing it.** He responds to working output —
a printed schedule, a real chart, a running app. Build the small version instead
of writing a paragraph about what it would look like.

**Say when something won't work.** He hasn't pushed back on bad news once. The
research that changed the plan most — don't scrape Canvas, don't market grade
improvements, don't use an LLM for scheduling — was all received and acted on.

**Speed is the constraint he cares about.** He wants to move fast and is right
that a lot of conventional startup advice is calendar-padding. The honest
distinction to keep making: what's *actually* slow because it depends on other
people (interviews, accounts, approvals) versus what's only slow because someone
wrote a six-week plan.

---

# The product

A study scheduler for university students. Free. UW first.

## The problem, stated precisely

It is not "students are disorganised." It's narrower, and the narrowness is the
whole product:

> A student sits down at 9pm knowing they have work to do, and spends the first
> twenty minutes deciding *what* to work on. They pick whatever is due soonest,
> which is rarely what matters most.

That's the "9pm decision problem." Everything in the product exists to answer it
before the student has to.

The secondary failure is estimation — students routinely underestimate how long
work takes by a factor of two, so even a good plan collapses by Wednesday.

## What it does

1. Reads Canvas deadlines from the student's own calendar feed URL
2. Learns their real week — classes, sleep, work shifts, commitments
3. Lays out study blocks with a specific task, a duration, a method, and a
   one-line reason each block is there
4. Rebuilds the week when they fall behind, which is the differentiating feature

## Why it can work

Twelve competitors were reviewed. The pattern is that nobody fills the whole row:

| | Knows deadlines | Reschedules | Knows *what* to study |
|---|---|---|---|
| Planners (Notion, MyStudyLife, Todoist) | yes | no | no |
| AI calendars (Motion, Reclaim) | no | yes | no |
| Study tools (Anki, Quizlet) | no | no | yes |
| Shovel | yes | partly | no |
| **Cram Fighter** | **yes** | **yes** | **yes** |

Cram Fighter fills every column — for two medical board exams, for money. That's
the strongest validation available and the clearest statement of what's open:
nobody does it for a normal undergraduate quarter, free.

Shovel is the closest real competitor. Mature, genuinely good, $39/year, and
already connects via the Canvas feed. The wedge against it is rescheduling and
topic-level planning, not deadline tracking.

## The honest caveats

**Don't market grade improvements.** The evidence for spaced retrieval in actual
classrooms is about a 2 percentage point effect across nine intro STEM courses,
with only two significant on their own. Laboratory effects are dramatic;
classroom effects are modest. University students will catch overclaiming faster
than any other audience, and getting caught once is fatal on a campus.

**Don't scrape Canvas.** It violates Instructure's terms, means handling
students' university credentials, and would get the project blocked by UW-IT and
remembered badly by the administration this eventually needs to sell to. The
public calendar feed carries what's needed and requires no approval at all.

## The metric that decides everything

**Week-4 retention.** Not signups. Planner apps get downloaded in week-1
optimism and abandoned by week 4. Under 25% and nothing else matters; over 40%
and there's something real here.

## Constraints

- **Launch: September 30 2026**, the first day of UW autumn quarter. 30 onboarded
  students before instruction begins.
- **Budget: $500–$5,000** for six months. Realistic spend is $1,500–$2,500.
- **One person**, AI-assisted. Every feature cut is a week returned.
- Free money worth chasing: GitHub Student Pack, cloud education credits,
  Anthropic/OpenAI startup credits, and UW's Dempsey Startup Competition
  ($92,500 awarded in 2026, $25,000 grand prize).

## Scale, for reference

UW has roughly 60,000 students across three campuses. The campus-density thesis
is that 40+ students in a single large course is worth more than 400 scattered
across a hundred courses, because shared topic maps and word of mouth both
compound within a course.

---

# Where things stand

**Updated: 2026-08-18** · 43 days to launch (September 30)

This file describes the present. It gets rewritten, not appended to.

---

## Right now

The domain layer is done and trustworthy. Canvas ingestion and the scheduling
engine are built, tested, and committed — 66 tests, no dependencies, no React.
Planning a full quarter takes ~21ms and is deterministic.

Nothing is on screen yet. The next stretch is all interface.

Zero student interviews done. That's the real risk on the board.

## Shipped

- **Canvas ingestion** — dependency-free iCal parser handling all three timestamp
  shapes including floating times across a DST boundary; course extraction, work
  classification, seed durations and grade weights, estimate revision from
  observed time
- **Scheduling engine** — scoring function, free-time discovery, greedy
  placement with constraints (deadline, busy time, daily cap, 20% buffer, 2-hour
  consecutive-course limit, exam sessions on separate days), generated per-block
  explanations, honest reporting of what didn't fit
- **Terminal tooling** — `npm run week` prints a real planned week; `npm run
  feed` prints raw Canvas deadlines and a workload-by-week chart
- **66 tests** covering timezone edges, every scheduling constraint, determinism,
  and a 150ms performance ceiling
- Next.js 16 / React 19 / Tailwind 4 scaffold, clean typecheck, lint, and build

## Next, in order

1. **Canvas feed proxy route** — the browser can't fetch the ICS directly (CORS),
   so a Next route handler fetches it server-side and returns parsed JSON
2. **Onboarding** — paste feed URL → see your courses and your quarter's workload
   chart. This screen is also the recruiting demo.
3. **Availability grid** — weekly click-and-drag to mark class, sleep, work
4. **Week view** — blocks with course, duration, method, and the "why now" line;
   mark done / skipped / partial; the **reschedule my week** button, which is the
   differentiating feature and does not get cut
5. **Local-first persistence** behind a storage interface
6. **Deploy** to a public URL and check it on a real phone

## Open questions

- Ship with no signup at all? Recommended, not decided. See `decisions.md`.
- Nothing in the product has been seen by a student. Every design choice so far
  rests on research and reasoning, not observation.

---

# Recent sessions

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

---

# Recent decisions

*Older decisions and the full findings log stay in the repo, in
`context/decisions.md` and `context/learned.md`. Ask for them if a question
turns on history this brief doesn't cover.*

## Open — needs a call

### Ship with no signup at all?

**Proposed:** everything in the browser, no account, no email. Data in local
storage behind an interface so Supabase can slot in later.

**For:** removes the single biggest drop-off point for a student trying something
a classmate mentioned, and removes an entire auth surface from a first build.

**Against:** no cross-device sync, and no usage data — which is awkward given
that week-4 retention is the metric that decides everything.

**Status:** recommended, not yet decided.

## 2026-08-18 · No test framework, no build step in the domain layer

**Decided:** `node --test` with Node 24's native TypeScript execution. Zero test
dependencies.

**Why:** the domain layer runs unchanged in the terminal, in tests, and in the
browser. `npm run week` prints a real planned week, which is a faster and more
honest check on a scoring change than any assertion. Requires
`allowImportingTsExtensions` and real `.ts` extensions on relative imports.

## 2026-08-18 · Every scoring term is bounded

**Decided:** the roadmap's `urgency × weight × decay × fit × (1/confidence)`
shape is kept, but each term is clamped.

**Why:** an unbounded `1/confidence` means one assignment a student rated 0.05 on
swamps five real deadlines and the schedule stops looking sane. Legibility beats
optimality here — a student who can't see why a block is there won't follow it.

## 2026-08-18 · Past-due Canvas items are surfaced, not scheduled

**Decided:** `includeOverdue` defaults to false. Overdue work comes back in a
separate `overdue` list for the student to confirm.

**Why:** also found by building. The first real preview of a planned week was
about 90% work from three weeks ago. A Canvas feed carries 30 days of history and
says nothing about what was submitted, so scheduling it — at maximum urgency, by
construction — buries the actual week under work already handed in.

**Revisit when:** there's submission status from somewhere. The feed will never
provide it.

## 2026-08-18 · Tasks pick slots, not slots picking tasks

**Decided:** rank work by everything that doesn't depend on timing, then let each
piece choose the best hour still open to it.

**Why:** this was found by building, not by planning. The obvious implementation
— walk time forward, drop in whatever scores highest at each opening — passed 61
of 62 tests. The failure was that a student who declared themselves an evening
person still got exam prep at 8am. It wasn't a tuning problem: when slots pick
tasks, the energy-fit term can only ever break ties between things competing for
the same hour, and can never *move* work to a better one. The "tailored to the
student" promise was structurally inert.

**Rejected:** (a) leaving it and tuning the weights — the term had no mechanism
to act through; (b) a two-pass version that deferred poor-fit placements and then
back-filled — the second pass simply re-filled the slot the first pass declined.

**Cost:** the inversion was 20× slower (15ms → 384ms). Fixed by precomputing the
hour grid and keeping per-course spans sorted, back to ~21ms. The perf test
ceiling is pinned at 150ms so this can't silently regress.

---

# Currently waiting on Brydon

- **Add Node to the shell.** The permission classifier blocked two attempts to
  write `~/.zshrc`. Until then every terminal needs
  `export PATH="$HOME/.local/node/bin:$PATH"`.
  ```
  echo 'export PATH="$HOME/.local/node/bin:$PATH"' >> ~/.zshrc
  ```
- **Run the planner against a real Canvas feed.** Everything so far is validated
  against fixtures. Don't paste the feed URL into a chat — it's a password.
  ```
  cd ~/Desktop/quarterly && npm run week -- "<your feed url>"
  ```
- **GitHub and Vercel accounts** before deploying. Account creation isn't
  something Claude can do.
- **Twenty interviews.** Not on the code critical path — run them in parallel,
  starting now.
