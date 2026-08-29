# What we've learned

Findings that cost something to obtain, recorded so they're never paid for twice.
Decisions go in `decisions.md`; this is the evidence underneath them.

The most valuable entries here are the ones that start "this didn't work."

---

## From students

**1 of 20 interviews done.** Still the largest hole in the project, and still
the thing no amount of building closes.

### Interview 1 · Brydon's brother (2026-08-18)

Outcome: liked the idea, could see himself using it, no substantive critique.

**Counts as zero signal, and it's worth being precise about why.** "I could see
myself using it" is the single least predictive answer in the set — it's a
prediction about future behaviour, and people are unreliable predictors of their
own future behaviour and excellent reporters of their recent past. A family
member also cannot say no, so the answer carries no information either way.

Two process notes for the remaining nineteen:

- **The product was shown.** That contaminates it. Once someone has seen the
  artifact they react to the artifact instead of describing their own week, and
  the thing you need is the week. Show it at the end, if at all.
- **No past-behaviour questions were asked**, which is where all the value is.
  The conversation is recoverable: he's family, he'll answer again.

What would have counted: an unprompted description of the 9pm decision problem,
a named planner he abandoned and why, or a duration he underestimated by 2x.

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

### `service_role` bypasses RLS and still could not read the table (2026-08-27)

With the secret finally matching, `/api/notify` went from 401 to 500:
`permission denied for table push_subscription`. The key was right and the role
was right.

`0001` grants every table to `authenticated` and nothing to `service_role`,
which was correct when it was written. The entire product ran in the browser as
the signed-in student, and this project has "automatically expose new tables"
off, so no default grant existed to paper over the gap. The notification sender
is the first thing in Quarterly that is **not a student**: it runs on a schedule
with no session and no `auth.uid()` to be.

**The thing to carry: bypassing RLS is not the same as being allowed to reach
the table.** RLS decides which rows, a grant decides whether the table exists
for you at all, and `service_role` skipping the first says nothing about the
second. Reasoning about it from "service_role can do anything" is what made this
look impossible for a few minutes.

`0004` grants `select, update` on `push_subscription` and `plan_state` and
nothing else. `profile` and `app_event` are deliberately left out: the sender
does not read them, and telemetry a server process can rewrite is not a
measurement.

**It failed silently for as long as it existed.** Every ten minutes the cron
recorded `succeeded` while the app returned 500 into a table nobody was reading.
Any scheduled job wants its response status checked once, by hand, before it is
believed.

### Everything about wiring notifications and sign-in lied at least once (2026-08-27)

Four separate steps reported success while being wrong. Each one is a small
gotcha; together they are the reason this took an evening rather than the twenty
minutes it looks like.

**`succeeded` in the cron log does not mean the app accepted the call.**
`cron.job_run_details` said `succeeded` twice while `/api/notify` was returning
401 both times. pg_net is asynchronous: `net.http_get` queues the request and
returns a request id, which is the "1 row" in the log. The real answer lands in
`net._http_response`, and that is the table to read:

    select status_code, error_msg, created from net._http_response
    order by created desc limit 3;

401 rather than 503 is itself informative. The route only checks the header when
`CRON_SECRET` is set, so a 401 proves the key reached Vercel and the values
disagree, while a 503 would have meant the env var never arrived.

**A placeholder in a pasted SQL statement runs perfectly happily.**
`vault.update_secret(..., 'PASTE_THE_SECRET_FROM_ENV_LOCAL')` succeeded and
stored the literal 31-character string. Nothing errors, because it is a valid
secret; it is just the wrong one. Checking `length`, `left` and `right` of the
decrypted secret against the known value diagnoses this without ever printing
it. Better still, build the statement in the shell so no hand substitution
exists to forget:

    printf "select vault.update_secret((select id from vault.secrets where
    name='quarterly_cron_secret'), '%s');" "$(grep '^CRON_SECRET=' .env.local |
    cut -d= -f2)" | pbcopy

**A first sign-in does not use the Magic Link template.** `signInWithOtp` with
`shouldCreateUser: true` sends **Confirm signup** to an address with no user
yet, and **Magic Link** on every sign-in after. They are separate templates and
both need `{{ .Token }}` with no `{{ .ConfirmationURL }}`. Editing only Magic
Link produces a first email containing a link and no code, which looks exactly
like the SMTP work having failed.

**Supabase's OTP length is a setting, and it was 8.** The app is built for six
throughout, and `normaliseCode` does `slice(0, CODE_LENGTH)`, so an 8-digit code
is silently truncated to its first six and rejected as wrong. The input simply
refuses the last two digits. Fixed in the dashboard rather than in the app,
because every string in the product says six. **Worth knowing that the app fails
this case silently:** if the setting ever drifts again, the symptom is "the code
does not work", with nothing anywhere naming the length as the cause.

### The Tailwind class that "produced no CSS" was never written down (2026-08-27)

`/week` needed two container widths, 1080px for the calendar and 672px for the
prose views. The conditional class did not work, so it was set with an inline
`style` and recorded in `status.md` as "`max-w-*` utilities produced no CSS,
it will bite again on a class that matters more".

That diagnosis was wrong, and the wrong version is the expensive part: it
describes a broken framework, which nobody can act on, instead of a rule, which
everybody can.

Tailwind reads **source text**. It has no idea what the code does, so a class
name assembled at runtime is a string it never sees and never generates. Written
out in full, both work. Checked by building and grepping the output CSS:
`max-w-2xl{max-width:var(--container-2xl)}` and
`max-w-\[1080px\]{max-width:1080px}` are both there, and the live page measures
1080 and 672 in the two views.

Two things worth keeping:

- **Every class name goes in the source whole.** Pick between complete strings,
  never build one by concatenation.
- **A grep of the built CSS settles this in one command**, and would have
  settled it the first time. `.next/static/chunks/*.css`, and remember Tailwind
  escapes the brackets, so `max-w-\[1080px\]` is what you are searching for.
  The first grep here missed it for exactly that reason and briefly looked like
  a confirmation of the original wrong theory.

### The drag lived on the element guaranteed to disappear (2026-08-27)

Brydon reported two things: dragging a block to another day made it vanish, and
dragging onto an overlapping block made it freeze and snap back. One root cause.

A block was only ever rendered by its own day column. Dragging into another day
made the source column return null while the target column had never heard of
it, so the element unmounted mid-gesture. Pointer capture dies with the element
it was set on, so no pointerup ever arrived and the drop never committed.

The same-day case was the same shape. `setPointerCapture` sat in a try/catch
that silently continued, and when capture failed, moving over another block sent
pointermove to *that* block, whose handler bailed on the id mismatch.

**The lesson generalises past this bug.** Both handlers were on the block, which
is the one element in the whole interaction guaranteed to be unmounted or
covered exactly when the drag gets interesting. Move and release now belong to
the grid, which is present for the entire gesture and under the pointer the
whole time.

**And this is the third time this feature has broken without a test noticing.**
Synthetic pointer events do not even enter the drag state, so it ends with a
human confirming it. Brydon did, by thumb, on 2026-08-27: cross-day and
drop-onto-occupied both work. The honest position stands that this component
cannot be verified here at all, so every future change to it costs a real thumb
again.

### A palette chosen by eye fails in ways nobody sees (2026-08-26)

The first category palette gave all six families the same lightness ladder and
separated them by hue alone. It failed 24 checks: deuteranopia folded deadline
into personal, protanopia folded class into focus, tritanopia folded class into
work. Hue is exactly what colour vision deficiency destroys, so a palette that
relies on it has no fallback.

Families now own lightness bands, and no two are neighbours on both axes at
once. Worst canonical pair went from confusable to ΔE 12.7.

**The finding worth keeping is about the tint, not the palette.** The week grid
paints blocks as `color-mix(colour 26%, surface)`. At that strength categories
10.9 apart collapse to about 2.6. Validating the pure colour said almost nothing
about what is on screen, and if the month view had reused the week grid's tint
treatment it would have been unreadable with nothing flagging it.

**Method note, and a near miss.** A hue sweep reported "0 failures" three times
while the script was crashing on a syntax error, because the check counted
`grep FAIL` instead of the exit code. Sanity checks in both directions now run
first: a known-registered value must read taken and a known-nonsense one must
read free.

### One flag, two writers, and the question never got answered (2026-08-26)

Brydon entered sleep hours during onboarding, found no way to save them, and
`/week` kept asking. Both halves were true and neither cause was the obvious one.

`/setup` saved the hours correctly on every keystroke. What it never did was set
`sleepConfirmed`, which is what the prompt keys off. So the prompt kept asking
someone who had already answered, nothing confirmed the save, and the only
control that dismissed it was "the default is fine", which is the one answer
that discards the real hours. He took the exit that worked and ended up on defaults.

Sleep is the only step whose resolution is a flag rather than derived from the
data, because a default nobody looked at and a default deliberately chosen are
identical in `availability`. That makes it the only step where a writer can
update the data and leave the question open.

**The fix was not to patch the call site.** Both writes now happen in one
function that both pages call, because patching `/setup` alone would have left
the next writer free to make the same mistake. That surfaced a second bug: the
onboarding path mapped over *existing* sleep blocks, so a student whose
availability had none kept the defaults while the screen looked like it saved.

### A daily cron would have made notifications look broken (2026-08-26)

The engine's best notice is `next-up`, which fires only when a block starts
within fifteen minutes and is deliberately exempt from the daily cap, because a
nudge that arrives late is worthless. Vercel's free tier caps cron at once a day.

Ran the real engine rather than reasoning about it: a block four hours away
returns nothing at all. A daily call would have produced silence for nearly
every student on nearly every day.

Switched to pg_cron every ten minutes, which is on Supabase's free tier. **The
general lesson is that a scheduler's cadence is part of its design**, and
inheriting whatever the host offers for free is how a feature ships inert.

### iOS web push is invisible rather than restricted (2026-08-26)

On iPhone, push works only from a home-screen install. In a Safari tab the Push
API is not merely restricted, it is absent, and there is no error: a student
would grant permission and receive nothing forever. Detected and named in the
toggle, because "add to home screen" is thirty seconds from working and
"unsupported browser" is a dead end. It also has to be step one when recruiting
testers.


### A weekly quota with no floor fills every day of the week (2026-08-23)

Brydon set Run to 5 a week and Quarterly to 4, and both appeared on every single
day. They were landing seven times each.

Sessions carried `placeBy`, a deadline, and nothing saying how early they could
land. A session belonging to week three was free to be placed tomorrow, and the
early-bias in slot value did exactly that, pulling future weeks forward until
the current one was full. `separateDays` then spread them one per day, which is
why it read as "every day" rather than as a pile on one afternoon.

**Fixing it exposed a second bug sitting underneath.** Placement went correct
and the text still said "5 of 4 this week" and "6 of 5 this week", because the
reason used the plan-wide session index and measured days-left from today rather
than from the block's own week. A block three weeks out claimed "only 1 days
left".

**Why the second one matters more than it looks:** "every block explains itself"
is one of four things this product claims over its competitors. A block
explaining itself as the sixth of five is worse than one that says nothing,
because it tells a student the reasons are decoration.

**The pattern, now four sessions running:** neither was found by a test. Both
were found by reading real output, and the second only because the first fix
made the output worth reading again.

### A lazily created client meant sign-in silently did nothing (2026-08-23)

The magic link worked, the email arrived fast, and the redirect landed on
`/week`. No session was created and nothing said so.

`supabase()` builds the client on first call, and `detectSessionInUrl` only runs
when the client is built. Nothing on `/week` touched Supabase, so no client
existed, and the code in the URL was never exchanged. The page looked identical
to a successful sign-in because it looks identical signed out.

**Lesson, and it is the same one as the deploys in August:** an operation whose
whole point is a side effect has to be verified by the side effect. "The page
loaded" is not evidence that signing in worked, any more than "git push
succeeded" was evidence that anything deployed.

The fix was mounting the auth hook in the root layout so any page creates the
client on arrival. The bug was that lazy creation and a side-effecting
constructor are a bad pair.

### autoFocus scrolled the first onboarding screen past its own heading (2026-08-22)

`autoFocus` on the step-one input scrolled the page 302px on load. Everything
rendered correctly, every element had opacity 1 and visibility visible, and the
page text contained all of it. It just wasn't where anyone would see it: a
student on a phone landed in the middle of a form having never seen the heading,
the blurb, or "Step 1 of 5".

Found by taking a screenshot and noticing the top of the page was missing, then
confirmed with `window.scrollY`. No test was going to catch this, because the
DOM was correct and so was the component.

**The fix has a trap in it.** Replacing `autoFocus` with
`ref.current?.focus({ preventScroll: true })` in an effect looks right and does
nothing, because the input does not exist on the first render: `hydrated` is
false and the component returns a loading state. An effect keyed only on the
step number fires once against a null ref and never runs again. `hydrated`
belongs in the deps.

**Why it's worth recording:** this is the session's recurring theme in yet
another costume. Code that runs cleanly and is quietly wrong, and a fix that
reports success while doing nothing.

### The fast first run had two bugs, and the second was silent (2026-08-21)

Written a script to print what a brand-new student actually gets from `/start`,
because it's the most-travelled path in the product and the one where a bad
result is least recoverable. It found both immediately.

**Sign up on a Friday, ask for four times a week, get one "didn't fit" on an
empty calendar.** A once-a-day habit can't happen four times in the three days
left, so the shortfall was arithmetic rather than a capacity problem — true, and
useless to be told.

**Worse: that unplaceable session blocked every later week.** Sessions run in
order, so session four never being placed meant sessions five through eight were
skipped forever. Any commitment that fell short once silently stopped being
scheduled, permanently. A Friday signup got 3 blocks where it should have had 9.

**And one thing that looked like a bug and wasn't.** Every block landing at the
same hour each day reads as broken, but it's the fit function working: it
matches cognitive demand to available energy, so the same kind of work lands in
the same band daily — and a consistent time is what makes a habit a habit. The
check now says so instead of warning about it.

**Method note:** the same approach as `npm run week` and `npm run my-week`.
Three scripts now, each printing real output for a path that matters, and each
has found a bug that no test was going to.

### Students describe this product's features when asked why they quit others (2026-08-20)

From a competitive teardown of nine planner apps. Three findings, in order of
how much they should change what gets built:

**Bottom tab bars beat hamburgers, decisively.** Up to 58% more engagement,
30%+ better feature discovery, users 2–3× less likely to find hidden items.
Directly reversed a decision made the day before.

**Time-to-value is the competitive game.** 60–90 seconds is the target; past
thirty minutes abandonment roughly triples. Motion needs 2–4 weeks and it is
their most-cited complaint. Shovel's headline is literally "Start Planning in
Seconds."

**Why students actually quit, in their words:** the maintenance burden exceeds
the value; when the plan breaks mid-week you either rework it by hand or stop
updating it; planners punish imperfection so a missed day ends the habit
entirely. Those are three sentences describing replan, the honest "didn't fit"
list, and the decision not to ship streaks — written by people who have never
seen this app.

**The marketing consequence:** the landing page was selling "plans your hours,"
which every competitor also claims. What students report wanting is "survives
you falling behind," which none of them claim.

### Offline works, and the PWA is now doing real work (2026-08-19)

Brydon confirmed the app loads in airplane mode after a service worker landed.
Worth recording because it's the first thing the installable-app decision has
actually bought beyond an icon: everything already lived in localStorage, so the
only reason it failed without a signal was that the page couldn't load.

Also the second feature this week that the automated browser could not verify —
service worker registration is blocked there, exactly as pointer drags were. The
pattern is clear enough to plan around: anything involving real device APIs or
real pointers gets built carefully and confirmed by a human, rather than costing
an hour of proving it to a headless browser.

### Drag needed three independent fixes, none of which a test would have caught (2026-08-19)

Confirmed working by Brydon on a real pointer. Getting there took three fixes,
each on its own enough to make the feature silently do nothing:

- `ref={gridRef}` was never attached, because a `str.replace` in a patch script
  matched nothing and reported success. The drop target always resolved to null.
- The move handler read drag state from the render closure, so a fast drag was
  handled before React committed the pointerdown render and bailed.
- The browser started a text selection instead of a drag, which swallowed the
  gesture entirely — no pointerup ever reached React.

**Two lessons.** Pointer interactions are close to untestable through synthetic
input; the honest move is to build them carefully and have a human confirm,
rather than burning an hour proving it to a headless browser. And the first
cause was the session's recurring theme again: an operation that reported
success while doing nothing. Patch scripts now assert before writing.

### Success messages lie, three times in two days (2026-08-19)

A pattern worth naming, because it has now cost real time.

The setup page said nothing and saved nothing, and looked identical either way.
`git push` succeeded while the site kept serving a commit from hours earlier,
because the project had no Git connection. `vercel --prod` reported success on a
deployment nobody outside the account can load, because Deployment Protection is
on by default.

None of these announced themselves. All three were caught by checking the actual
artifact: reading localStorage, curling the live URL, following the redirect.

**The habit:** after any action whose whole point is a side effect, verify the
side effect rather than the return value. A green checkmark describes the
command, not the world.

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
