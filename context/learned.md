# What we've learned

Findings that cost something to obtain, recorded so they're never paid for twice.
Decisions go in `decisions.md`; this is the evidence underneath them.

The most valuable entries here are the ones that start "this didn't work."

---

## From students

**Nothing yet.** 0 of 20 interviews done. This is the largest hole in the project
and no amount of building closes it.

The four numbers that matter, from the week-1 playbook:

- How many of 20 describe the 9pm decision problem *unprompted*? 8+ → proceed.
  Under 8 → the thesis needs revising, not more code.
- How many gave a phone number unprompted? That's the alpha list. Under 10 → the
  problem is distribution, not product.
- What did they abandon, and why? This is retention research, free.
- What was heard that nobody predicted? The single most valuable output, and the
  one thing no document written in advance can contain.

The rule: **ask what they did, never what they'd want.** "Would you use this?"
gets a polite yes from everyone and teaches nothing. "Walk me through last Sunday
— what did you work on and how did you decide?" gets the truth.

---

## From building

### Nearly every bug this session came from looking, not testing (2026-08-18)

A tally worth keeping, because it should shape how the next stretch is built.
Found by reading real output or clicking the real UI: the 11pm run, the 4.6-hour
Tuesday, the 90%-past-due week, the energy-fit feature being structurally inert,
setup discarding saved work hours, colliding block ids after a replan, the
calendar never drawing the work schedule, a run labelled WORK SESSION.

Found by a test first: essentially one, the host-allowlist bypass, and only
because the test was written specifically to attempt the bypass.

**The lesson is not that tests are low value.** All 122 exist to stop these
coming back, and the suite caught real regressions during three separate
refactors. The lesson is that tests confirm what you already thought to check,
and the expensive bugs live in what you didn't. Build the thing that lets you
look at real output early: `npm run week` and `npm run my-week` paid for
themselves several times over.

### One daily ceiling for every day is a plan that dies on Thursday (2026-08-18)

The first run of Brydon's real week put 4.6 hours on Tuesday and 0.6 on
Saturday. Both were legal: the daily cap was a single number, and the early-bias
term pulled everything toward the nearest days. After a nine-hour shift plus
commute, 4.6 hours of project work is fiction; meanwhile the genuinely open day
sat empty.

Two fixes. The ceiling is now per weekday, and slot value includes how open the
day already is, so work slides onto an empty day rather than stacking on a full
one. Result: 2.1 to 3.1 hours a day across six days instead of three brutal
evenings.

**Why it generalises:** this is the same bug a student hits in week 8 with a free
Sunday and a brutal Wednesday. The off-season fixture caught it early because a
full-time job makes the imbalance obvious.

### The scheduler was right and the schedule was wrong (2026-08-18)

It scheduled a run at 11:00pm for someone who sleeps at midnight, and by its own
model that was the correct answer: running is low cognitive demand, so it fits a
low-energy hour better than anything else does.

**Lesson:** a scoring function only knows what you put in it. Anything that is
never acceptable at any score is a constraint, not a term, and belongs in the
filter rather than the arithmetic. Three of the four fixes in this session were
the same mistake in different clothes.

### An empty Canvas feed is the launch-day default (2026-08-18)

Brydon connected his real UW feed and it returned a valid calendar with zero
assignments. Not a bug: Canvas feeds carry 30 days back and a year forward, and
instructors publish assignments when they publish the course, often in the final
week before instruction starts.

**Why this matters more than it looks.** Launch is September 30, the first day of
autumn quarter. Students will onboard in the days *before* that. The single most
likely first experience of this product is an empty feed. "0 courses · 0
assignments" reads as a broken app, and a student who concludes it's broken in
week 0 never comes back in week 1.

The empty state now says the feed works, explains that it's timing, and routes
them into setting up availability, which doesn't depend on Canvas at all. That
turns the dead end into the useful half of onboarding.

**Open question for the interviews:** how many students would try this before
their quarter is published, and would they come back?

### webcal:// broke the terminal scripts but not the web route (2026-08-18)

Canvas's "Calendar Feed" button copies a `webcal://` URL. The web route
normalises it; both terminal scripts tested for `^https?://` only, so a valid URL
fell through to the file branch and failed with "no such file". Reported as
"couldn't load the feed", which reads like a bad link.

**Lesson:** the same input normalisation existed in two places and only one got
fixed. Shared validation belongs in one module used by everything, which is where
`src/lib/canvas/feed-url.ts` came from.

### The host allowlist had a suffix bypass (2026-08-18)

Matching `canvas.` anywhere in a hostname accepted
`canvas.uw.edu.attacker.com`, a domain anyone can register, turning the feed
route into an open proxy. Anchored to the suffix instead. Caught by a test
written specifically to try the bypass, not by the tests confirming valid URLs
work.

### The energy-fit feature was structurally inert (2026-08-18)

Wrote the scheduler the obvious way: walk time forward, at each opening place
whatever scores highest. 61 of 62 tests passed. The one failure — an evening
person getting exam prep at 8am — turned out not to be a tuning problem but a
structural one. When slots pick tasks, a fit term can only break ties; it can
never move work to a better hour.

**The generalisable lesson:** a feature can pass every test around it and still
do nothing, if the architecture gives it no mechanism to act through. The test
that caught it was a behavioural one ("an evening student gets demanding work in
the evening"), not a unit test of the scoring function — which was correct all
along.

### The first honest preview was 90% past-due work (2026-08-18)

Running the planner against the sample feed produced a week almost entirely
composed of work from three weeks earlier, every block labelled "Past due."
Overdue items score maximum urgency by construction, and a Canvas feed carries 30
days of history without ever saying what was submitted.

**Lesson:** the terminal preview found this in one run. No test would have — the
schedule was *correct* by every constraint, and useless. Build the thing that
lets you look at real output.

### Inverting the loop cost 20× in speed (2026-08-18)

15ms → 384ms. The culprits were `Intl` formatting inside the inner loop (each
local-hour lookup is expensive) and re-scanning the full block list for every
candidate placement. Fixed by precomputing an hour grid once and keeping
per-course spans sorted. Back to ~21ms.

### Two parser bugs that ran cleanly and were quietly wrong (2026-08-17)

Both from the original week-1 script, both caught by tests:

- Timezone conversion accumulated an offset instead of recomputing it, putting
  every `TZID`-format deadline 7 hours late. Invisible without checking.
- The work classifier read "Major Paper 2 Final" as an exam, because the generic
  word won before the specific one.

**Lesson, and the one to carry into every AI-assisted session:** the failure mode
is not code that crashes. It's code that runs cleanly and is wrong. Write the
test that would catch the plausible mistake, not the one that confirms the happy
path.

### All-day deadlines are due at the *end* of the day (2026-08-18)

Canvas emits all-day items with no time. Treating them as due at midnight
starting that day silently removes a full day of runway from every one of them —
and makes anything due today read as already missed.

---

## From research

### Canvas access is a solved problem (2026-08-17)

Every Canvas student has a public per-user iCal feed at Calendar → Calendar Feed.
No OAuth, no approval, no credentials. It carries assignments and due dates and
is how Shovel does it. The feed covers 30 days back and 366 forward, so it's
often empty between quarters — which is a support question, not a bug.

By contrast, UW's formal LMS Vendor Integration Program takes up to six months of
data-privacy agreements.

### The competitive gap is real and specific (2026-08-17)

Twelve competitors reviewed. Nobody fills all three of: knows deadlines,
reschedules automatically, knows what to study. Cram Fighter fills all three —
for two medical board exams, paid. That's both the strongest validation and the
clearest map of what's open.

Shovel is the closest: mature, good, $39/year, already uses the Canvas feed. The
wedge is rescheduling and topic-level planning, not deadline tracking.

### Spaced retrieval works far better in labs than in classrooms (2026-08-17)

Real-classroom effect is about 2 percentage points across nine intro STEM
courses, only two significant on their own. Enough to justify retrieval practice
as a sensible default; nowhere near enough to advertise grade improvements.
University students will catch overclaiming faster than any other audience.

### Non-dilutive money exists on campus (2026-08-17)

UW's Dempsey Startup Competition awarded $92,500 in 2026 with a $25,000 grand
prize; Jones + Foster provides accelerator funding. Designed for exactly this
situation. Application goes in over winter break, with real users as the pitch.
