# Interface overhaul: morning report

Branch `claude/ui-overhaul`, 22 commits on top of `main` at `e76c187`. Nothing
pushed, merged or deployed. `src/lib/`, Supabase, env files, config, the
service worker and notification delivery are untouched: every changed file is
in `src/app`, `src/components`, four presentational hooks in `src/hooks`, or
`docs/ui-review`. `npm run check` and `npm run palette` pass on the final
commit.

## Review it

The branch is checked out in its own worktree, so review it there rather than
in the main checkout.

```bash
cd ~/Desktop/quarterly/.claude/worktrees/ui-overhaul
```

```bash
git log --oneline main..claude/ui-overhaul
```

```bash
open docs/ui-review/index.html
```

That page shows before and after side by side for every screen and state,
with a phone/laptop, light/dark and first-screen/whole-page switch. It works
straight from disk.

To use it live (port 3000 unless another session is on it):

```bash
export PATH="$HOME/.local/node/bin:$PATH" && npm run dev
```

To re-run the measurements against a running server (writes
`docs/ui-review/after/checks.json`):

```bash
node docs/ui-review/capture.mjs docs/ui-review/after --base http://localhost:3000 --checks
```

When you are done with it, after merging or deciding not to:

```bash
git -C ~/Desktop/quarterly worktree remove .claude/worktrees/ui-overhaul
```

## The numbers

Measured by `capture.mjs --checks` against production builds of `main` and of
this branch at `2ac7a5c` (the one later commit, `2ba67ff`, changes one line of
copy and was re-checked on the dev server). Phone profile: 390px, 4x CPU
slowdown, 1.6 Mbps, 150ms latency.

| | before | after |
|---|---|---|
| Text below WCAG AA, all 24 screens and states, 390 and 1280, both themes | 2,774 elements, in all 92 runs | 0 of 8,158 |
| Horizontal scroll at 375px | none | none |
| Layout shift, cold load of /week | 0.158 | 0 |
| Real week on screen, cold / warm | 1,845 / 108 ms | 1,901 / 123 ms |
| Script over the wire | 228 KB | 231 KB, no new dependencies |

The contrast scanner proves itself before each run by catching two planted
failures (the old `--faint` grey as text, and ink at 45% opacity).

## Bugs found and fixed on the way

These were not taste. Each is in the commit named.

- **The +, the undo toast and the add sheet were pinned to the page, not the
  screen, on /week.** The entrance animation left a transform on `<main>`,
  which made it the containing block for everything fixed inside it. On a
  phone the + sat 2,900px down the page and the sheet opened mid-scroll.
  `b16dfcf`, `73fd07d`
- **The week grid's hour labels were about twenty minutes early.** The gutter
  started at the top of the row while each column started with its date
  header. `507ef17`
- **White text on the accent on /setup** measured 1.26 to 2.72:1 in every dark
  theme. `88cf758`
- **The saved toasts on /setup and /settings were drawn behind the phone tab
  bar**, so nobody saw them. `73fd07d`, `88cf758`, `604a00c`
- **The day view used a different palette from the week**, so the same block
  changed colour between screens, against the 2026-08-26 decision. `f65a368`
- **The focus rule reshaped whatever had focus** to a 4px radius, and global
  rules were unlayered, so `outline-none` and similar utilities silently lost.
  That is where the double ring on /import came from. `b16dfcf`, `6549e10`
- **Every field was 14px**, which makes iOS zoom the page on focus and stay
  zoomed. All fields are 16px now.
- **"1 blocks recorded."** `604a00c`

## What changed, screen by screen

**The system** `b16dfcf`, `6549e10`, `02183e2`. Six type steps (xs, sm, base
keep Tailwind's sizes; title 20, heading 26, display 36 are new, with tracking
that tightens as they grow). Three radii (4px, 10px, full), two elevation
levels, tabular figures on the body, motion tokens (180ms enter, 120ms exit,
240ms move, a damped spring). Named buttons, field, chip, segmented control
and well. Press states on every button and link, declared once. Tailwind's
default type, radius and shadow scales are removed at the end, so an
off-system value renders as nothing instead of quietly becoming an eighth
size. `--faint` is no longer used for text anywhere except disabled buttons,
which the contrast rule exempts.

**Header, tab bar, footer, sheet, toast** `73fd07d`. Solid header, active rule
on the bar's edge, 12px tab labels. The sheet renders into `<body>`, slides up
on a phone, settles in on a laptop, and ignores the pointer while it leaves.
One toast replaces four.

**/week** `bedd9ef`, `507ef17`, `2ba67ff`. The top of the screen is the next
block: "Next · 3:00 PM, in 1h 20m", its name, its reason and the one filled
Done. It says "Still open" for a block today whose time passed and "Now" for
one under way. The list is a timeline with times in one column and course
colour as a thin rule; answered blocks collapse to a line at the end of the
day; empty days are one line. Checking a block off sends it down into the
done rows and brings the next one up, the done count ticks up, and the row
eases to its muted state with the tick landing on the spring. One primary at
a time: "Plan from today" after an absence, otherwise the next block's Done.
Replan is secondary. The calendar's fixed time recedes into neutral bands
edged in category colour, labels are 12px, today is marked, the now line
glides, and replan motion is 240ms instead of 560ms. Loading is a skeleton in
the week's shape.

**Month** `c74b792`. No box around each day; today is the accent disc; dates
outside the month stay readable.

**/day** `f65a368`. Opens on the block that matters, then blocks and fixed
events on one time axis with a live marker at now, then where the day goes.
Colours match the week.

**Add sheet** `493f5e4`. 16px fields with labels above, a segmented mode
switch, category chips, one primary.

**/** `3b10138`. The cards, the hover states that did nothing and the pill
badge are gone. One display size.

**/start** `9efedd2`. Choices are chips, so Plan my week is the only filled
thing. "How many times a week?" lets all seven options fit one row at 375px.

**/import** `93bdeef`. The error sits under the field that caused it. One box,
for the pending import. Two em dashes out of the copy.

**/setup** `88cf758`. One primary at the end, chips for toggles, 16px fields,
readable dark mode, a toast you can see.

**/settings** `604a00c`. Signing in is the one primary; backup and
notifications are secondary; restoring a backup is the danger style because
it overwrites everything. Captions readable.

**/privacy** `c82153a`. 16px body at a readable measure, ruled sections. No
words changed.

**/onboarding** `b29c7cc`, **/welcome** `1a4ec54`. The same controls as
everywhere else.

**Layout** `2ac7a5c`. The content area is at least a screen tall, so the
footer starts below the fold and nothing visible moves when a page hydrates.

## Left alone, deliberately

- **The welcome carousel's 720ms block movement.** Over the 300ms ceiling, but
  it is the one piece of motion that is a demo to be watched, and
  `globals.css` records why it is slow. Cutting it to 240ms is a one-line
  change in `.sketch-block` if you want the ceiling to be absolute.
- **The palette.** Not a single value changed. `npm run palette` passes.
- **Theme colours in `src/lib/themes.ts`.** Off limits, and it turned out not
  to matter: every contrast failure came from which token was used for text,
  not from the tokens.
- **All copy that carries meaning.** I changed wording only where it was
  wrong or filler: "appear below" on a phone list that never shows them, "0
  blocks · 0.0h planned", "takes you to the result", instruction rows under
  the grid, "× a week", and em dashes.
- **Page titles.** "This week" sits over fourteen days, and /setup is titled
  "Your week" under a tab called Plan. Renaming is a product call.
- **`context/`.** Another branch is writing `sessions.md` tonight, so I did not
  touch any of it. Two entries are now out of date and are yours to update:
  status.md's "blocks travel to their new slots at 560ms with a 24ms stagger"
  (now 240ms, 20ms, capped at 100ms), and the 2026-08-19 decision's "one
  0.32s entrance animation" (now 180ms, opacity only on page containers).

## Not sure it looks better

- **Removing the footer from the first screen of short pages** (`2ac7a5c`).
  It is what gets layout shift to 0, and on a phone the footer was already
  below the fold on every real page. Alternative: give each placeholder the
  height of its page instead, which is more code and fragile.
- **The first-visit entrance on /week.** The brief asked for it, once per
  session, 24ms a row. It costs the Largest Contentful Paint metric: with it,
  LCP on the throttled phone is 2.4s cold and 3.4s warm; without it, 2.1s and
  0.36s. The week is in the page at the same moment either way and the
  entrance finishes within 400ms, so it is a metric cost more than a felt
  one. If Lighthouse scores matter to you, delete the `stagger` argument in
  `week/page.tsx` and it is gone.
- **The display size on the landing page** is 36px at every width. It was
  44px on a laptop. 44 is the alternative if the laptop landing feels quiet.
- **Grid blocks are a 14% tint** of their colour with a full-strength edge,
  down from 24%. The alternative is no fill at all, edge only, which is
  calmer still but makes category families harder to spot at a glance.
- **The next block appears once, at the top, and not again in the list.** A
  student scanning the list for today will find it above the list rather
  than in time order. The alternative is to repeat it in the list with its
  buttons, which duplicates the one primary action.
- **Replan is secondary** except when nothing is planned. If students look for
  it and do not find it, making it primary again is one class.

## Audit items not done

- **The "why" lines contain em dashes**, for example between "Session 1 of 3"
  and "you haven't started this yet". They are generated in
  `src/lib/schedule`, which was off limits.
- **Hand-added tasks have no course colour.** A task added in the sheet with
  "MATH 126" as its course is not in `state.courses`, so every such block
  falls back to the accent in every view. Fixing it means registering a
  course or assigning a colour, which is data, not presentation.
- **Missed blocks from earlier days are not shown on /week.** The week starts
  today, so after a lapse the banner can say "8 blocks still open" while only
  today's are answerable there; the rest are reachable through /day. This
  predates tonight. Showing them would be a new capability, so I left it.
- **Two counters on one block**: "session 1 of 9" (across the fortnight) and
  "1 of 4 this week" (in the reason). Now labelled, still both there.
- **/setup still puts its primary action at the end of a long page.** Everything
  above it is demoted so it is the only filled button, but it is not sticky
  the way /start's is.
- **Touch targets inside the grid.** Short blocks and fixed bands are smaller
  than 44px by nature; the grid is the laptop default and the list is the
  phone default, so this mainly affects someone who picks Calendar on a
  phone.
- **Reduced motion** is handled in CSS, in the motion hook, in the count-up and
  in the exit timing, but I verified it by reading rather than by driving the
  app with the preference on.
- **The Next dev badge** is hidden in screenshots only; it is not part of the
  product.

## Things you should know about the night

- **~/Desktop is synced by iCloud Drive**, and iCloud writes a "name 2" copy
  when a file is rewritten while it is uploading. That happened to 60
  screenshots, which I removed after checking they were the stale set, and
  to `.next/types`, where duplicate `routes.d 2.ts` files broke `tsc`. One
  commit, `2ac7a5c`, was made in the same command as a check that failed for
  that reason; the source was fine, the check passed on the same tree once
  the copies were deleted, and every commit after it is gated on a passing
  check. Worth moving the repo off the Desktop: this will bite `next build`
  and `tsc` again.
- **Port 3000 belonged to another session**, so I ran this worktree's dev
  server on 3100 from a config in my own scratch folder. The repo's
  `.claude/launch.json` is unchanged.
- **At the very end the preview tool could no longer start a production
  server** in the worktree (`EINTR` reading the working directory, likely the
  same iCloud behaviour), which is why the final commit's copy change was
  re-checked on the dev server rather than a fresh production build.
- Screenshots are seeded through the app's own screens, not written by hand:
  `/start`, `/setup`, the add sheet and Replan, under a clock pinned to
  Wednesday 23 September at 1:40pm. The seed is in `docs/ui-review/seeds/`,
  so the after set is the same week at the same minute as the before set.
