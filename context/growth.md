# Growth

*Written 2026-09-21. The synthesis of three research agents: competitor
landscape, campus growth playbook, and a pre-launch UX audit. Rewritten, not
appended to.*

**The bet.** Brydon against a friend: most users by 1 January 2027, minimum 1000
to win, real money on it.

---

## Read this part first, because it can lose the bet on a technicality

**Heron cannot currently count its own users, and the reason is a feature.**

The best conversion asset in the product is that it works with no account. The
fast path at `/start` asks two questions and never asks for an email. That is
deliberate and it should stay. But it means there is no row in any table for the
majority of people who will use this, and `src/supabase/events.ts:44-46` drops
every event when signed out, so today a student can use Heron for a month and
leave no trace anywhere.

Two consequences, both of which need settling before the first user arrives:

1. **Agree the counting rule with the friend, in writing, this week.** Signups
   are not the same as installs are not the same as activated users. If the rule
   is not fixed in advance, whoever is behind on 1 January will argue about
   definitions. Propose: **activated = a device that connected a calendar and
   generated at least one week.** It is the honest number, it is the one that
   predicts retention, and it is defensible because it cannot be inflated by a
   button that says "sign up".

2. **Instrument the device, not the user.** `logEvent` has to fire signed out,
   keyed on a random device id in local storage. Without that, the 28 October
   retention fork in `roadmap.md` is unmeasurable and every gate below is
   unenforceable. This is the single highest-value piece of engineering in the
   whole plan and it is roughly a day of work.

**Do not solve the counting problem by adding an account requirement.** It would
trade the best-converting property of the product for a number, and the number
would then be smaller. Instrument instead.

---

## The window

| Date | What it is |
|---|---|
| **Sept 24 to Oct 4** | Dawg Daze. 604 events from 315 partners in 2025, ~60% RSO-hosted. |
| Sept 30 | Instruction begins. Launch date. |
| Oct 19 to Nov 1 | First midterms. Highest intent of the quarter. |
| Nov 2 to Nov 15 | Winter registration. Students are literally building next quarter. |
| Nov 25 to Nov 29 | Thanksgiving. Dead. |
| Dec 11 | Instruction ends. |
| Dec 12 to Dec 18 | Finals. |
| **Jan 1 2027** | The bet settles. |

The bet's deadline is 1 January but the **acquisition window closes around 12
December**. Nobody adopts a study planner over winter break. Plan against 82
days, not 102, and treat the last three weeks of December as a period where the
number can only go down.

**The plan starts 24 September, not 30 September.** Six free days at the front,
during the one week of the year when students are actively shopping for tools,
is worth more than any week in November.

---

## Who we are actually against

Not Shovel, not Motion, not Reclaim. Three real opponents:

**1. Wick got to UW first.** Maximal Learning, Bellevue, founded 2023. Free with
in-app purchases. Canvas, Moodle, Blackboard and D2L sync, syllabus date
extraction, SMS reminders, Pomodoro. It has a **University of Washington landing
page** with UW-email onboarding and subscribable UW sports, club and department
calendars. 4.3 stars on 65 iOS ratings, which is presence without penetration.

The differentiator against Wick is **not** Canvas sync and **not** free, because
Wick is both. It is that Wick tracks deadlines and Heron **commits hours and
reports what did not fit**. Demo it against a week Wick would silently accept.

**2. ChatGPT is the incumbent, and it is free until 31 October.** 88% of
students report using AI in their learning. "Plan my study week" is a documented
mainstream prompt, recommended by university IT departments. OpenAI is giving US
college students four free months of Plus, claimable through 31 October, which
covers the exact weeks of this launch.

A chat model produces a plausible week instantly and for nothing. The ground it
cannot hold is the ground the standing rule already stakes out: a deterministic
plan that does not reshuffle on refresh, survives Wednesday when the student
falls behind, and tells them what it dropped. **Make "it does not change its
mind" an explicit, demonstrated claim in launch copy.** That sentence is the
whole counter-position and it has never been written down for a student to read.

**3. The Canvas breach makes the architecture the lead message.** The 2026 Canvas
breach: unauthorised access 25 April, disclosed 1 May, second ransomware attack
7 May. 8,809 institutions, ShinyHunters claiming ~275 million users. Names,
emails, student ID numbers and user messages confirmed exposed. A US Department
of Education security alert, university-wide notices at UC, Rutgers and Memphis,
class-action filings, and one of the largest forced API-key rotation events on
record.

Every competitor asks a student to *connect* Canvas. Heron asks for a calendar
feed and never holds a credential. The Canvas API policy says nothing about iCal
feeds, so the feed approach sits outside the tokens that got rotated.

**This belongs on the landing page above the scheduling story.** The corollary is
that the standing rule "a feed URL is a password" is now something students have
been primed to care about, so onboarding must show exactly what Heron stores and
offer a one-click feed rotation path.

**Platform risk is answered:** Instructure ships no first-party student planner
and announced none in 2026. Everything AI-shaped in their roadmap is
educator-first and gated behind paid tiers.

---

## Channels, ranked by signups per hour of founder time

All signup figures are estimates built on cited conversion rates, not
measurements. Plan against the low end.

| # | Channel | Signups | Cost | Effort |
|---|---|---|---|---|
| 1 | Instructor Canvas announcements, large lectures | 300-450 | $0 | 20h |
| 2 | RSO leader outreach, warm, via his own org | 200-280 | $0 | 40h |
| 3 | Group-availability invite loop (product) | 200-300 | build | 30h |
| 4 | Greek chapters, paid per verified signup | 150-250 | $600-1000 | 10h |
| 5 | Dawg Daze tabling under his RSO | 120-180 | ~$100 | 20h |
| 6 | r/udub launch post, 86.9k members | 60-200 | $0 | 3h |
| 7 | RA and floor-meeting route | 60-120 | $0 | 12h |
| 8 | The Daily, as an article not an ad | 80-200 | $0 | 4h |
| 9 | Flyers and QR | 50-90 | $150 | 15h |
| 10 | TikTok and Instagram | 50-250, huge variance | $0 | 40h+ |
| 11 | Campus and class Discords | 40-120 | $0 | 8h |

### The single highest-leverage thing: borrowed authority

UW's large service courses seat 400-700. One instructor posting one Canvas
announcement puts a trust signal in front of ~500 students who are already
inside Canvas, which is exactly where Heron's value lands. At 8-15% conversion
from an endorsed in-Canvas link, that is 40-75 signups per yes. Ten yeses is a
third of the bet.

The trust signal is the entire problem: **a stranger's planner link is spam, the
same link from CHEM 142's instructor is a resource.** It also compounds
correctly, because every instructor who says yes is reusable in week 5 and week
10 with a different message.

Ask for a one-line announcement, not class time. Supply the exact copy. Expect a
10-20% reply rate, so **send 60 asks, between 25 and 27 September**, before
faculty inboxes close for the quarter.

Same trick with orgs: UW has over 1,000 RSOs, and Brydon is Sponsorship Lead of
a 51-person team, so he can get warm intros. A leader posting in a 60-person
Slack converts around 20%.

Greek bounties are a proven mechanic rather than a guess: Fizz paid clubs per
member signed up, and UW Greek life is 55 chapters and over 4,000 active
members, the densest addressable graph on campus. Offer $150 per 50 verified
activated signups. That is $3 each and, critically, it is delegated work, which
is what makes October survivable around the FE exam.

### Viral mechanics, honestly priced

Group find-a-time is worth building, but expect **k around 0.2 to 0.35, not 1**.
Consumer apps land between 0.15 and 0.5. It earns its place for one structural
reason: the invite *is* the feature, the same property that spread When2meet and
Doodle with no marketing. At 700 seeded users and k=0.3 over three cycles it
adds roughly 300 users, which is the margin between missing and making the bet.

Two things kill it. Availability is sensitive, so scope sharing to one group, one
week, free/busy only, and say so on the invite screen. And the need is episodic,
so invites arrive in bursts; do not model steady-state k off launch week.

**Cheaper and probably higher volume: make the week view screenshot-shaped.**
Saturn's entire spread came from students sharing schedules. One tap producing a
clean image of your week with a small heron.study mark is a day of work and
rides behaviour that already exists rather than asking for new behaviour.

---

## Week by week, with cumulative targets

| Window | Message | Target |
|---|---|---|
| Sept 24-29, Dawg Daze | *Your whole quarter, laid out, before it starts.* | seed |
| Sept 30-Oct 4, syllabus week | Orientation, not rescue. Nobody feels behind yet. | 120 |
| Oct 5-11 | First problem sets land, so the product finally has data. Ship group availability. | 250 |
| Oct 12-18, FE exam | Everything delegated. Greek bounties launch. Zero founder outreach. | 350 |
| Oct 19-Nov 1, midterms | *You had a bad week. Here's the rebuilt one.* | 560 |
| Nov 2-15, registration | *See what next quarter's schedule does to your week.* | 760 |
| Nov 16-29 | Harvest referrals. Thanksgiving is dead. No new tactics. | 900 |
| Nov 30-Dec 5 | *Finals plan in two minutes.* Spend remaining budget on bounties. | 1050 |

Tabling shape: four shifts of two hours, 10am to 3pm, two people. **Do not hand
out paper.** Hold your phone, ask "what's your first deadline?", connect their
calendar in 40 seconds, hand the phone back with their week on it.

---

## The product work that gates all of it

From the UX audit, ranked by users lost. Items 1, 2, 4 and 5 shipped on
2026-09-21 in `ce08813`.

**Still open, in order:**

**A. Email codes do not reach students.** Resend runs on the shared
`onboarding@resend.dev` sender, which delivers only to Brydon's address. Until
`heron.study` is verified in Resend, every literal signup is lost at the terminal
step. Nothing else on this list matters as much.

**B. The Canvas feed is imported once and then forgotten. This is the week-4
killer.** `import/page.tsx` tells the student "Heron uses it once to fetch, then
forgets it", and no `feedUrl` exists in `store.ts`. The security reasoning is
sound, but the consequence is that the product's headline input decays: a
student imports in week 1, instructors publish through weeks 2 and 3, and by
week 4 the plan is quietly built on a stale deadline set. That is exactly the
"runs cleanly and is quietly wrong" failure `CLAUDE.md` warns about. Recovering
means finding the Canvas feed URL again, which needs a desktop browser.

This is not a polish item and it is not a UX problem. It is the thing that
decides the 28 October retention number.

**C. Nothing anywhere invites installation.** No `beforeinstallprompt`, no "Add
to Home Screen" affordance. The only install instruction in the product is
inside the notification toggle in Settings, which is disabled until you are
signed in. So the iOS chain is: find Settings, sign in by email code, be told to
install, install, re-enable. Push, the main retention mechanism, will reach
approximately nobody.

**D. The week grid is 1288px wide on a 375px phone.** Fixed `minWidth` of 92px
across 14 columns at a fixed height of 640. That is 2.5 visible days, and the
drag-to-move interaction the product is proud of is unusable at 92px. Default
`/week` to `list` on small screens, or ship a single-day column.

**E. The tab bar renders to strangers** on `/`, `/welcome` and `/start`, so a
first-time visitor can tap straight into an empty week and bypass the funnel.

**F. No share affordance exists.** No `navigator.share`, no invite. Word of mouth
is the entire distribution plan and there is no way to pass it on.

**G. The landing page spends two of six sections on caveats.** The "if it's
summer" paragraph is stale on 30 September. Honesty is the brand, so keep the
no-grade-claims line, but move the Canvas-is-empty explainer to `/import` where
it is actionable.

---

## Measurement

Tag every link with `?s=` for source and `?c=` for the specific class, chapter or
org. Events needed: `landed`, `first_open`, `canvas_connected`, `week_generated`,
`start_completed`, `pwa_installed`, `return_d7`, `replan_used`, `invite_sent`,
`invite_accepted`. All of them must fire signed out.

Weekly dashboard, five numbers: activated this week, cumulative against the
target line above, activated by source, D7 return rate, and measured k.

### Gates, set in advance so they cannot be rationalised later

- **Oct 11, under 250 cumulative:** the endorsement motion is not landing. Move
  money to chapter bounties immediately.
- **Oct 18, instructor reply rate under 10% on 60 asks:** stop cold email. Warm
  intros only, through the RSO network and TA friends.
- **Nov 1, measured k under 0.15:** stop investing in group scheduling. Ship the
  shareable week image instead.
- **Nov 8, under 650:** buy the gap. $1,200 at $3 per verified activated signup
  is 400 users.
- **Any week with D7 return under 25%:** stop acquiring for one week and fix
  retention. At this scale word of mouth is the plan, and a leaky product runs
  it in reverse.

---

## What not to do

**Do not add an account requirement.** The no-account onboarding is the best
conversion asset in the product. Instrument the device instead.

**Do not run a real ambassador programme.** Fizz pays ambassadors $75 a week; ten
reps for ten weeks is $7,500 and a management job that does not exist in this
schedule. Pay per verified signup instead.

**Do not buy Daily display ads or paid social.** At low-thousands scale the
volume is too thin to learn from, and the CAC advantage runs the other way
against campus word of mouth. Pitch The Daily's news desk instead: a solo ECE
senior who built a free planner is a story they will run for free.

**Do not launch on Product Hunt or Hacker News.** Every user it brings is the
wrong university.

**Do not post in r/udub more than twice.** Comment for two weeks first, post as a
student who built a thing, answer every comment for six hours. One post in
October, one genuinely different post in mid-November. A second promotional post
inside six weeks is what turns a campus subreddit hostile.

**Do not treat TikTok as a channel.** Organic conversion is 1-5%, a viral hit
delivers non-UW users, and the bet is one university. Cap it at two posts a week
and never let it displace channels 1 through 4.

**Do not add a second campus, an app store build, a waitlist, or swag.**

**Do not build an LLM into the scheduler** to make a demo more impressive. It is
the counter-position against the largest competitor in the category.

---

## Caveats on this document

Every signup figure is an estimate derived from cited conversion rates and UW's
real population figures. The rates, the calendar, the RSO and Greek counts, the
HUB posting rules, the competitor pricing, the breach facts and the ambassador
pay are sourced. The totals are not.

Reddit was unreachable to the competitor research agent, so the absence of Reddit
evidence in section "Who we are actually against" is a gap in the research, not a
finding.

Most "best planner app 2026" listicles are vendor content marketing, including
DormWay's own. Their competitor descriptions are positioning, not audit.
