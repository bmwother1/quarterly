# Quarterly — project brief

*Generated 2026-08-21 from the project's `context/` files by `npm run handoff`.
Don't edit this by hand; edit the source files and regenerate.*

This is the standing context for Quarterly. It covers the person building it,
what's being built, where it stands, and what has already been decided — so a
conversation can start from here instead of from scratch.

**40 days to launch** (September 30 2026).

---

# Who you're working with

Sourced from his own CLAUDE.md (2026-08-18). Accurate, not inferred.

## Who

Electrical & Computer Engineering senior at UW, class of 2027, based in Kenmore
WA. Focus: embedded systems, hardware design, computer architecture. Builds end
to end and doesn't consider a prototype finished until it runs on real hardware
with a real interface.

FE Electrical & Computer exam October 2026. Sponsorship Lead for the UW Solar
Vehicle Team (51 people). Deep golf domain knowledge from three years in a pro
shop. DJs and runs an FPV/aerial YouTube channel.

## Technical background

**Languages:** Python, JavaScript/TypeScript, Verilog, Java, C/C++ (Arduino,
embedded)

**Web stack he already ships:** Next.js, TypeScript, Supabase (Postgres, RLS,
storage), Tailwind, shadcn/ui, Vercel, FastAPI, React

**Hardware:** KiCad, Quartus, ModelSim, Fusion 360, Raspberry Pi 5, Arduino,
systemd, SQLite, sensor integration, FPV builds

**Also:** SQL migrations, REST integration, Anthropic API

### What this means for Quarterly

He is not learning this stack. He is currently running SQL migrations against
Supabase for another Next.js/TypeScript/Vercel product (Prismwave Network, a
verification-led professional network built for his mother's HR/biotech
consultancy).

So: skip explanations of React, Next, Tailwind, Supabase, deployment, and Git.
Explain the parts specific to *this* project, the scheduler's design, and
anything genuinely non-obvious. shadcn/ui is a safe default for UI here since he
already uses it.

Prior work worth knowing: a Kalshi weather bot on a Pi via systemd (killed after
forward testing found no edge, which is the right instinct), a World Cup bracket
coherence engine, and a DIY golf launch monitor using Doppler radar with a
FastAPI backend and React dashboard.

## How to work with him

His own rules, verbatim in substance:

- Give a direct recommendation, not a list of options. If there are tradeoffs,
  pick one and say why.
- Concrete next steps over extended planning. Give the command to run.
- Be concise. Skip preamble. Skip summaries of what you just did.
- **No em dashes.** No AI filler ("delve", "it's worth noting", "let's dive in").
- If what he's asking for is a bad idea, say so before writing the code.
- Assume he can read code. Explain the non-obvious parts, not the syntax.

Two things confirmed in practice: he pushed back correctly on a padded week-1
estimate (installing Node took three minutes, not a week), and he has taken
every piece of bad news and acted on it. Don't soften findings.

## Context that shapes decisions

Solo, AI-assisted, launching September 30 2026. Budget $500 to $5,000 for six
months. Two other active projects competing for the same hours, so scope
discipline matters more than architecture.

---

# The product

A scheduler for students that plans around the life they actually have. Free.
UW first.

**The positioning shifted on 2026-08-18 and it matters.** This started as a study
planner driven by Canvas. Building the off-season case — recurring commitments
with no deadline — showed that the engine never cared where work came from.
Canvas is one input, not the product. That change does three things: it makes the
app useful in the eight months a year that aren't midterms, it removes the
seasonality problem that would otherwise make every summer a dead zone, and it
widens the addressable user from "student with heavy coursework" to "student with
a job, a sport, and a side project", which is most of them.

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

## What actually differentiates it

Four things, in the order they'd convince a sceptical user:

1. **It plans hours, not lists.** Almost everything else tells you what's due.
   This works out when each piece happens, in sessions long enough to be worth
   sitting down for, around time already spent.
2. **Every block explains itself.** The reason is generated from whichever
   scoring term actually dominated, so it's a real account of the ranking rather
   than decoration. A student who can't see why a block exists won't do it.
3. **It refuses to lie about capacity.** Work that doesn't fit comes back with a
   reason while there's still time to act. Every competitor quietly overbooks and
   lets Thursday deliver the news.
4. **It reschedules on demand, not silently.** Silent reshuffling is why planners
   become fiction: nothing ever feels missed and the app always says you're fine.

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

**Updated: 2026-08-21** · 40 days to launch (September 30)

This file describes the present. It gets rewritten, not appended to.

Repo: `bmwother1/quarterly` (**public**). Live and current at
`quarterly-alpha.vercel.app`. Pushes to `main` auto-deploy.

---

## Right now

The product is built and works. Engine, interface, deployment, privacy page,
A student can describe their week, or import Canvas, Google, Apple or Outlook, get a real plan
as a calendar, check blocks off, and replan around what actually happened.
170 tests.

Two things are not true yet, and both matter more than anything on the Shipped
list:

1. **Nobody has used it.** One interview, logged honestly as zero signal.
2. **Nothing measures retention**, which is the number that decides the project.

## Shipped

- **Scheduling engine** — scoring function, free-time discovery, constraint-aware
  placement, generated per-block explanations, honest reporting of what didn't
  fit. ~21ms for a full quarter, deterministic
- **Calendar import** — one paste box for Canvas, Google, Apple and Outlook.
  Dependency-free iCal parser handling all three timestamp shapes across DST,
  plus recurrence expansion, which is what makes a personal timetable usable
- **Recurring commitments** — weekly quotas with no deadline, so it works outside
  a quarter. This is what makes the product usable in August
- **Feed route** — server-side fetch, host allowlist, private-range refusal,
  redirects off, size cap, timeout, URL never logged or stored
- **Interface** — landing, two-question first run, import, setup, calendar grid,
  day view, check-off, explicit replanning, conflict resolution, undo, offline
- **Privacy page** written against the code, with a working delete control
- **Persistence** — localStorage behind an interface, no signup

## Next, in order

1. **Nineteen more interviews.** Nothing else on this list matters as much.
2. **Use it himself for a full week.** The closest available proxy for retention.
3. **Supabase** — sync, and the usage data that week-4 retention needs.
4. **Syllabus parsing** — the one job an LLM genuinely belongs in.
5. Tailwind build oddity: `max-w-*` utilities produced no CSS, so the calendar
   width is set inline. It will bite again on a class that matters more.

## Struck from the plan

- **Google Calendar two-way sync.** `calendar.events` is a sensitive scope whose
  verification is running five-plus weeks for real developers, and writing back
  via a subscription feed is worse than nothing because Google refreshes those
  every 12–24 hours. Reading any calendar in via its ICS link shipped instead
  and covers most of the value.

## Open questions

- Would a student who connected in week 0, saw an empty feed, and set up their
  week by hand come back when the quarter starts?
- Does anyone outside this project describe the 9pm decision problem unprompted?
- What is the business model? Free for students is the acquisition strategy, not
  a revenue plan, and nothing has been decided beyond that.

---

## The plan to September 30 (42 days)

Sequencing note that changes the obvious order: **push notifications need a
server-side subscription store and a scheduled job, so Supabase comes first.**
Notifications are the higher-value feature but they cannot be built standalone.

### Now → Sunday Aug 23 · prove it survives a real week
- Brydon uses it himself, every day, with his actual schedule. Whether he still
  opens it on day five is the closest available proxy for week-4 retention.
- Five interviews. Past behaviour only, product not shown.

### Aug 24 → Aug 30 · the data layer
- Supabase: accounts, sync, and the first thing that actually measures retention.
- Learned energy pattern: replace the self-declared dropdown with observed
  completion rate by hour. Better data than a self-report, and it is already
  being collected.
- Ten more interviews. Fifteen total by month end.

### Aug 31 → Sept 13 · the retention features
- Push notifications. One a day, always carrying the block's reason.
  Report, never command. No streaks. The decision logic and copy are already
  written and tested; only delivery is waiting on Supabase.
- Syllabus parsing, so a block can name the topic rather than just the course.

### Sept 14 → Sept 22 · feature freeze
- No new features. Onboarding, empty states, bugs, and the first-run experience
  only. Every feature added inside two weeks of launch ships untested by a real
  student.

### Sept 23 → Sept 30 · recruit
- Thirty students onboarded before instruction begins.
- The workload chart is the pitch: show someone their own quarter as a chart.

### The one number that decides everything
Week-4 retention, measured from Sept 30. Under 25% and nothing else matters.
Over 40% and there is something real here. Nothing measures it until Supabase
ships, which is the real reason it is first.

---

# Recent sessions

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

---

# Recent decisions

*Older decisions and the full findings log stay in the repo, in
`context/decisions.md` and `context/learned.md`. Ask for them if a question
turns on history this brief doesn't cover.*

## 2026-08-21 · Import from any calendar; never write back

**Decided:** one paste box at `/import` accepts Canvas, Google, Apple and
Outlook. The server decides what a feed's contents mean from where it came
from — Canvas produces assignments to schedule, everything else produces fixed
events to schedule around. Quarterly does not publish a feed back out.

**Why not write back, which was the obvious ask:** Google refreshes subscribed
calendars every 12–24 hours and won't let you force it. For a static timetable
that's fine; for a scheduler whose entire premise is that the plan changes when
you fall behind, the copy in their calendar would routinely show a plan already
replanned. Two sources of truth with the stale one being the calendar they
actually check. Better to ship no write-sync than a wrong one.

**Why not Google's API:** `calendar.events` is a sensitive scope requiring
verification — video demo, written justification, Trust & Safety review — with
real developers reporting five-plus weeks under review and no response. The
roadmap had two-way Google sync in phase three, Aug 31 to Sept 13. It could not
have landed, and building it first would have been how we found out.

**What it actually needed:** recurrence. A Canvas feed is nearly all one-off
deadlines so RRULE was ignored and nothing was lost. A personal calendar is the
opposite — a timetable is *all* recurrence, and without expansion it imports as
a single Tuesday lecture while the scheduler books over the rest of the term.

**What it deliberately doesn't do:** monthly and yearly rules are counted and
reported, never guessed at. Treating a monthly club meeting as weekly would put
four times as much in a student's calendar as exists. All-day entries are
dropped too — blacking out every hour of spring break is the opposite of the
truth.

**The security note:** widening the allowlist from one provider to four is
exactly how the lookalike-domain bug gets reintroduced four more times.
Suffix matching now lives in one place, and there's a test that tries
`calendar.google.com.attacker.com` and its equivalent for every provider.

## 2026-08-21 · A stacked bar, not a pie — and a validated palette

**Decided:** the day view answers "where does this day go" with one horizontal
stacked bar. Tapping a day in the week grid or a bar in the workload chart opens
it.

**Why not the pie that was asked for:** part-to-whole is a stacked bar's job.
Comparing segment lengths along one axis is a much easier read than comparing
wedge angles, long course names have somewhere to sit, and the bar still works
at 10px tall on a phone. The calendar column is also already a proportional
picture of the day, so a pie of the same data would duplicate it.

**The bigger finding:** the course colours, picked by eye months ago, failed a
colourblind check. The original pink and green sat at ΔE 4.9 under
deuteranopia against a ≥8 target — roughly one man in twelve could not tell two
of their courses apart. Replaced with a set validated in both modes: worst
adjacent CVD ΔE 9.1 light, 8.4 dark.

**Two rules that keep it valid.** Hues are assigned in fixed order and never
cycled into new ones — a ninth course reuses slot one rather than inventing a
colour indistinguishable from an existing one. And colour follows the entity,
not its position in a list, so removing a course never repaints the others.

Three light steps fall below 3:1 contrast, so every segment carries a visible
label. Colour is never the only encoding.

## 2026-08-21 · An appointment beats a plan, including a pinned one

**Decided:** adding or moving a one-off event resolves whatever it lands on,
immediately. Blocks move; the event doesn't. Pinned blocks move too, and get
named in a notice. Finished blocks are never touched.

**Why the event wins:** an appointment has a real time in the world and a study
block does not, so only one of the two *can* move. That isn't a judgement call.

**Why pinned blocks move as well:** a pin means "the scheduler should stop
arguing with me about this hour," which is a preference. An appointment is a
fact. The fact wins — but silently overriding the one place the app promised to
defer would be worse than the collision, so it says what it did: *"Moved
Quarterly — you'd placed it where Dentist is."*

**Why finished blocks don't move:** a completed block is a record of what
happened, not a plan. Rewriting it to tidy the calendar is falsifying history.

**Does auto-replanning here breach "replanning is explicit"?** No, and the
distinction matters. That rule is about not absorbing your *failures* quietly —
a missed block must never just vanish. Here the student has told the app about a
new constraint, and reacting to an instruction they gave is cause and effect,
not silent absorption. Same reasoning as the menu closing on click rather than
on a path change.

## 2026-08-20 · Bottom tab bar, reversing the hamburger

**Decided:** three tabs fixed to the bottom on phones, inline links on laptops.
The hamburger built the day before is gone.

**Why, and this reverses a decision made on request:** the evidence is
one-sided. Bottom tab bars lift engagement up to 58% over hidden menus, feature
discovery rises 30%+ when apps switch, and users are 2–3× less likely to find
anything behind a hamburger at all. Google measured a 76% usage increase from
bottom-aligned navigation.

The ergonomic half decides it for this product specifically. A hamburger sits
top-right, the hardest place to reach one-handed, and a student checking their
next block on the walk to class has one thumb.

**Three tabs, not four.** Canvas is a once-ever setup action, so it lives inside
Plan rather than spending a permanent tab.

**Superseded:** the hamburger menu from 2026-08-19.

## 2026-08-20 · First run is two questions

**Decided:** `/start` asks what you want to make time for and how often, then
plans and drops you on the calendar. Everything else waits.

**Why:** time-to-first-value should land inside 60–90 seconds; past ten minutes
abandonment climbs steeply and past thirty it roughly triples. Motion's 2–4 week
setup is its single most-cited complaint across three review sites. The previous
route in was a five-section form — the same mistake in miniature.

Every setting except one already has a working default. The only input the
scheduler genuinely cannot invent is something to schedule, so it's the only
thing asked for.

**Measured:** two taps, three seconds, ten blocks on a real calendar. It was
three to five minutes.

**Canvas stays out of it.** Feeds are empty in August by construction, and it
asks for a credential to an entire schedule before the product has proven
anything — the worst possible moment to ask.

---

# Currently waiting on Brydon

- **Deployment Protection** is still on, so the `*-bmwother1s-projects.vercel.app`
  URLs redirect to a Vercel login. `quarterly-alpha.vercel.app` is unaffected and
  is the one to share, but turn protection off to avoid confusing yourself later.
- **The interviews.** Ask what they did last Sunday. Don't show the product.
- **Use it for a week.**
- **Supabase project** — send the project URL and the *anon* key (never the
  service_role key). Unblocks sync, retention measurement, and notification
  delivery, which all depend on it.
