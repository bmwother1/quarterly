# The next three months

*Written 2026-08-24. Covers now to late November. Rewritten, not appended to.*

Three months from today is week 8 of autumn quarter. The quarter ends 11
December. So this window contains the launch, the number the project lives on,
and the first real answer to whether any of it works.

Everything below is gated on that number rather than sequenced by appetite. A
roadmap that ignores it is a wish list.

---

## The fork

**Week-4 retention, measured 28 October.** Brydon set the thresholds in advance,
which is the part most people skip and the reason he cannot fool himself here.

| Result | What month three is |
|---|---|
| Under 25% | Not more features. The thesis is wrong and the next month is interviews and a rebuild of the premise. |
| 25% to 40% | The likely case. Fix the specific reason people stopped, which the telemetry can now actually tell you. |
| Over 40% | Build the growth engine. Groups. |

Nothing in November should be planned in detail today, because the honest answer
is that the number decides it.

---

## Now to 30 September · make one path excellent

Thirty-six days, and the last two weeks are a freeze. So this is really three
weeks of building.

Four things, in order. The first two are the difference between the pitch being
true and being nearly true.

### 1. Notification delivery

The engine exists: decision logic, copy, a banned-phrase list, 14 tests. It
produces a `Notice` object that nothing on earth can deliver. No VAPID keys, no
`pushManager`, no `showNotification`, and the `push_subscription` table has never
had a row written to it.

**Why it is first.** Today the app only works if a student remembers to open it.
That is the definition of the planner people abandon in week 3. One notification
a day carrying the block's reason is the single largest lever on the number this
whole project is being judged by.

**The constraint that has to be in the recruiting script:** iOS web push only
works after the student adds the app to their home screen. Not a footnote. If
thirty students sign up in Safari and never install, the highest-value feature
reaches none of them.

### 2. Syllabus parsing, or cut the claim

`product.md` has a three-column table and claims Quarterly fills all three. It
does not. A block says "CHEM 142" and a duration; it has no idea what to study.
Today the product is Shovel plus rescheduling, which is a real wedge and is not
the one the pitch describes.

Two honest options and both are fine:

- **Build it.** This is the one job an LLM genuinely belongs in, and it stays out
  of the scheduling path, so the determinism rule holds.
- **Cut the claim.** Costs nothing, takes ten minutes, and overclaiming to
  students is the mistake Brydon himself called fatal on a campus.

**Decide which by 1 September.** Carrying an untrue claim into recruiting week is
the worst of both.

### 3. One screen made properly

Not a redesign. The app is a competent prototype and looks like one, and that is
survivable: students told the competitors they quit over maintenance burden, not
aesthetics.

But the rebuild is the only thing structurally out of reach for Outlook, Monday
and Notion, and right now it looks like every other screen. If one thing gets
real design attention it is the moment a broken week repairs itself.

### 4. Tests on the paths a student actually walks

5,475 lines of React with zero tests, and every bug Brydon has personally hit
lived there: the 4.6-hour Tuesday, the autoFocus scroll, the drag that silently
did nothing, sign-in wiping a work schedule.

Not full coverage. Three paths: first run to planned week, sign in with existing
local data, and mark blocks then replan.

### Also, before the freeze

- Custom SMTP. Supabase's built-in sender is documented as testing-only and
  thirty students onboarding on one evening will hit the wall.
- The security review, against the real diff rather than in the abstract.
- A retention policy and an answer to "what happens to the data if you stop
  running this". Those are the questions a campus procurement review opens with.

---

## October · the month with no building in it

Brydon sits the FE exam this month, during the single most important measurement
window the project has.

**Plan for that rather than discovering it.** Everything that needs attention
must be automated before 30 September or it will not happen. What ships in
October is bug fixes. What he does in October is watch `app_event` and talk to
the thirty students.

This is not a gap in the plan. It is the plan. A product that cannot survive its
founder being busy for a month is not going to survive a quarter.

---

## November · what the number bought

Assume the middle case, because it is the likely one.

The difference from every previous month is that guessing stops. `app_event`
answers, for the first time with real data:

- Which day of week 2 people stopped opening it
- Whether they replan or just leave
- Whether blocks get marked at all, or the app becomes a read-only calendar
- Whether the students who imported Canvas behaved differently from those who did not

That last one alone reshapes the pitch.

**Groups only if retention clears 40%.** It is the only unprompted feature
request anyone has made, and it is the strongest distribution mechanism
available: one student invites four, which is the campus-density thesis in
product form. It also makes accounts mandatory, exposes when a student is free,
and splits the retention measurement across two promises. All three are
acceptable once the core number is proven and disqualifying before.

---

## What the app actually looks like in late November

Functionally, five things are true that are not true today.

**It reaches you.** One notification a day, carrying the reason. Today Quarterly
is a thing you have to remember; then it is a thing that tells you.

**It knows what to study, not just when.** A block reads "CHEM 142, gas laws,
practice problems" rather than "CHEM 142, 90 minutes". That is the third column
of the competitive table and the difference between Shovel and Cram Fighter.

**It knows your real energy.** Today it asks in a dropdown and then ignores what
it observes. `observed.ts` already collects completion rate by hour and the
`Insights` panel already reads it. In November the observation leads and the
dropdown is a fallback for the first two weeks.

**It knows how long things actually take you.** Underestimating by a factor of
two is the secondary problem in `product.md` and nothing currently addresses it
where a student can see. `applyLearnedEstimates` exists and works silently. It
should say so: "you planned two hours, the last four took you three and a half".

**It survives being neglected.** The returning-student path exists now and has
never been tested by real absence. By November it will have been, thirty times.

---

## What gets deleted

A scope that only adds is a scope nobody believes.

- **`/setup` as a third door.** `/start`, `/onboarding` and `/setup` all
  configure the same state. Two survive.
- **The declared energy dropdown**, once observation is good enough. Asking a
  student to describe themselves and then measuring the opposite is worse than
  not asking.
- **`/canvas`** if import absorbs it, which it likely has.

---

## What I would refuse to build in this window

- **Streaks or gamification.** Students said planners punish imperfection and a
  missed day ends the habit. Adding a streak is building the thing they quit.
- **An LLM in the scheduling path.** The week reshuffles on refresh and they stop
  trusting it.
- **A native app before the number.** Apple rejects thin wrappers, and the App
  Store solves discovery, which is not the problem. Thirty specific people at one
  campus is the problem.
- **Google two-way sync.** Already struck on evidence and nothing has changed.

---

## The one line

By late November the app should be something that tells you what to study,
reaches you without being opened, and knows more about your week than you told
it. Everything else is the same product with a better answer to whether anyone
wants it.
