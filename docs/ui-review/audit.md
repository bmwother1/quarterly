# Interface audit, before any change

Taken 2026-09-23 against `main` at `e76c187`. Screenshots are in `before/`, one
per screen and state at 390px and 1280px in both themes, each with a
`--fold` twin showing only the first screen. They were produced by
`capture.mjs` against a week seeded through the app's own screens, with the
clock pinned to Wednesday 23 September, 1:40pm Pacific.

Line numbers refer to `e76c187`.

## Bugs found while auditing

These are presentation bugs, not taste, and they come first because they
break things a student does.

1. **Everything `position: fixed` inside `/week` is pinned to the page, not
   the screen.** The `.rise` entrance animation on `<main>`
   (`src/app/week/page.tsx:144`, `globals.css:185`) leaves a filled
   `transform` on the element, and Chrome then treats `<main>` as the
   containing block for fixed descendants. On a phone the floating + sits
   about 2,900px down the page instead of above the tab bar. The add sheet
   opens mid-page with its backdrop covering only part of the screen
   (`before/week-add-sheet--390--light--fold.webp`). The undo toast and the
   "moved" notice have the same fault. `/setup` and `/settings` render their
   toasts inside a `.rise` main too (`setup/page.tsx:65`,
   `settings/page.tsx:41`).
2. **White text on the accent in dark mode.** `setup/page.tsx:225`, `:303` and
   `:427` hard-code `text-white` where every other button uses
   `--accent-ink`. Dark accents are light, so this measures 2.67:1 (Ember),
   2.54 (Ink), 1.74 (Moss), 2.72 (Plum) and 1.26:1 (Slate).
3. **The day view paints blocks from a different palette than the week.**
   `day/[date]/page.tsx:26-37` colours by `seriesVar` in list order, so Run is
   green on `/week` and orange on `/day`, and Study is purple on one and blue
   on the other. The 2026-08-26 decision says week and day both read category
   and shade.
4. **"1 blocks recorded."** `insights.tsx:150` has no singular form.

## Generated tells

### One box around everything, all at one weight

- Every block is a bordered, shadowed, 12px-radius card with the same
  padding, whether it is done, past or next (`block-card.tsx:34-49`). Twenty
  identical cards in a column, each with three buttons, gives the eye nothing
  to land on.
- Every planned card carries a filled accent **Done** button, 31 of them down
  the phone list, plus the filled Replan above (`block-card.tsx:148-167`).
  Nothing is primary when everything is.
- Banners, setup prompt, didn't-fit list, selected event, import result,
  Apple help and privacy note all use the same `rounded-xl border bg-surface
  p-4` box (`week/page.tsx:159`, `:186`, `:223`, `:259`, `:330`;
  `setup-prompt.tsx:59`, `:89`; `import/page.tsx:176`, `:216`, `:283`).
- Landing feature grid is four equal cards with hover states that do nothing
  (`page.tsx:63-84`, `:122`).
- The day view's three numbers sit in a boxed stat grid (`day-bar.tsx:79-86`)
  that repeats "Unscheduled" already shown in the legend above it.

### Radius, shadow, type and spacing not from one system

- **Six radii**: `rounded` (4px), `rounded-sm`, `rounded-lg`, `rounded-xl`,
  `rounded-2xl`, `rounded-full`, plus `rounded-[3px]`. Inputs alone use three
  (`setup/page.tsx:104` `rounded`, `add-item.tsx:173` `rounded-lg`,
  `start/page.tsx:127` `rounded-xl`).
- **Five shadows**: the two tokens plus Tailwind's `shadow-sm`, `shadow-md`
  and `shadow-lg` (`setup/page.tsx:218`, `settings/page.tsx:128`).
- **Thirteen type sizes**, seven of them one-off arbitrary values:
  `text-[10px]` (`week-grid.tsx:271`, `:370`, `:405`, `:452`;
  `block-card.tsx:70`), `text-[11px]` (`site-header.tsx:176`,
  `month-grid.tsx:197`, `:230`), and five different display sizes
  `text-[1.6rem]` to `text-[2.75rem]` across `page.tsx:23`,
  `start/page.tsx:111`, `onboarding-shell.tsx:50`, `welcome/page.tsx:128`.
- Letter spacing tightens only on `h1` and `h2` (`globals.css:162-163`), so a
  large `<p>` or button gets none and a small `h2` gets it anyway.
- Hard-coded hex outside the token system: fixed-commitment colours
  `#64748b`, `#7c3aed`, `#0891b2`, `#475569` (`week-grid.tsx:19-24`, `:223`).
- Spacing is on the 4px grid in name only: `p-3.5`, `py-2.5`, `mt-2.5`,
  `gap-1.5`, `mt-0.5`, `-bottom-[13px]` (`site-header.tsx:126`) sit beside
  the 4px steps.

### Decoration without a job

- Uppercase tracked micro-labels: the block's method (`block-card.tsx:77`) and
  "moved by you" at 10px (`:70`), "Didn't fit" on `/welcome`
  (`welcome/page.tsx:98`).
- A pill badge for "No account needed" (`page.tsx:54-61`).
- A glassy blurred backdrop behind the sheet (`sheet.tsx:44`) and a blurred
  translucent header and tab bar (`site-header.tsx:93`, `:165`). The tab bar
  blur is justified; the header one mostly smears content.
- The why line is set as a pull quote with a left rule (`block-card.tsx:79`).
- `transition-all` on every block card (`block-card.tsx:34`) and on the
  welcome dots (`welcome/page.tsx:141`).

### Copy

- Em dashes in visible copy, against house style: `page.tsx:91`,
  `setup/page.tsx:169`, `import/page.tsx:241`, `:291`, `block-card.tsx:113`.
- "0 blocks · 0.0h planned" on an empty week (`week/page.tsx:152`) reads as a
  bug rather than a fresh start.
- The empty week says classes and shifts will "appear below"
  (`week/page.tsx:162`). On a phone the default is the list, which never shows
  them.
- Instruction text that describes the UI instead of the UI explaining
  itself: "tap a block for the reason, or drag it to move it", "scroll
  sideways for next week" (`week-grid.tsx:228-229`), "Tap a block to see why
  it's there and mark it off. Shaded bands are the hours you already gave
  away." (`week/page.tsx:373`), "takes you to the result"
  (`setup/page.tsx:229`).
- "Nothing scheduled." printed under every empty day, up to fourteen times
  (`week/page.tsx:419`).
- The week's page title is "This week" over fourteen days; `/setup`'s title is
  "Your week" under a tab called Plan. Left as is: renaming is product copy,
  not presentation.
- No filler of the "Supercharge" kind anywhere. The voice is good; the
  problems are density and repetition, not tone.

### Contrast (WCAG AA, 4.5:1 for body text)

Measured across all five themes in `src/lib/themes.ts`, both modes.

- `--faint` fails as text in every theme and mode: 2.45 to 3.96:1 on `--bg`.
  It is used as a text colour 68 times across 23 files, including the week
  grid's hour labels (`week-grid.tsx:271`), times in the day view
  (`day/[date]/page.tsx:88`), the stat labels (`day-bar.tsx:82`), the footer
  (`site-header.tsx:195`), helper copy and every "cancel" link.
- `--muted` passes everywhere (4.55 to 7.48). The tightest is Ink light at
  4.55:1, which leaves no room for a third, lighter text grey.
- White on accent in dark mode, see bug 2.
- Warn text on `--accent-soft` is 4.44:1 in Ink light, used by the import
  error and the backup error (`import/page.tsx:202`, `backup-controls.tsx:94`).
- Block labels in the grid are 10px on a 24% tint; they pass on contrast
  but fail on size.

### Motion

- Entrance animation is 320ms (`globals.css:185`), over the 300ms ceiling,
  and replays on every view switch (`week/page.tsx:304`) and on every block
  card as it mounts (`block-card.tsx:34`), so the whole list fades in again
  on every visit rather than once per session.
- Replan FLIP runs 560ms with an overshoot curve and up to 160ms of stagger
  (`use-plan-motion.ts:49-61`). It is the right idea at twice the length.
- Check-off has no confirmation beyond the card turning to 60% opacity with
  no transition on the text (`block-card.tsx:35`), and the header's hours
  figure jumps.
- The now line ticks once a minute but snaps rather than glides
  (`week-grid.tsx:165-170`, `:340-349`).
- Press states (`active:`) appear on about 14 of 67 buttons. Links in the header, tab bar, view
  switcher, month cells, grid blocks and every secondary button have none.
- Focus ring is a global 2px outline with a fixed 4px radius
  (`globals.css:167-171`), so it draws square corners around 12px-radius
  buttons and doubles up with `focus:border-accent` on inputs
  (`import/page.tsx:163`, `start/page.tsx:127`).
- Welcome carousel uses 720ms with overshoot (`globals.css:203-209`). This is
  a demo meant to be watched, documented as such; see the report.
- Reduced motion is honoured globally by shortening durations
  (`globals.css:211-217`), but the FLIP hook checks it separately and the
  entrance keyframe still translates.

### Loading and empty states

- Loading is a bare line of text on an empty page ("Loading your week…",
  `week/page.tsx:125-131`; "Loading…" in five other pages). It is what the
  server sends, so it is what a cold load shows first, and the real layout
  then jumps in underneath the header.
- `Checking…` text for account and notification state (`account-panel.tsx:32`,
  `notification-toggle.tsx:43`) shifts the settings page when it resolves.
- No spinners anywhere, which is right.

## Eye friction: finding today's next block

Measured on the seeded Wednesday at 1:40pm, where the answer is "Capstone
project, 3:00 to 4:30pm".

1. **Phone, `/week`**: the first 600px are the title, a block count, the
   Replan button, the "last planned" date and the view switcher
   (`week/page.tsx:148-295`). The first card is a block already marked done.
   The next block is the second card, about 500px down and partly under the
   tab bar, with the same weight as the done card above it and the thirty
   below.
2. **Laptop, `/week`**: the answer is a 10px label in a 92px column. Finding
   it means locating today's column (only its header text is accent), then
   the now line, then reading down past it. The block's time is not visible
   unless the block is tall enough (`week-grid.tsx:467`).
3. **Times are not on one axis.** In the list, the time sits after a colour
   dot inside a card inside a padded list, so each block's time starts at a
   different x than the day heading and nothing lines up down the page
   (`block-card.tsx:52-58`). Ranges are written "3:00 PM–4:30 PM", repeating
   the meridiem and wrapping at 390px next to the duration and session count.
4. **Two counters that disagree in the same row.** "1 of 9" (session index
   over the fortnight, `block-card.tsx:60-64`) sits above "1 of 4 this week."
   (the why line). The eye has to reconcile them.
5. **Course code truncation.** Grid blocks truncate from the end with an
   ellipsis at 10px: "Capstone pro…", "Study for a cl…" (`week-grid.tsx:464`).
   Course codes survive only because they are short; nothing protects them.
6. **The day view leads with a chart.** "Where the day goes", a stacked bar,
   a legend and a stat grid all come before the first block
   (`day/[date]/page.tsx:74-80`). Navigation is three equal text links, one
   underlined (`:55-65`).
7. **Two primary buttons on a bad week.** The away banner's "Plan from today"
   and the "Replan from now" button below it are both filled accent
   (`week/page.tsx:195-200`, `:236-241`). The lapse banner says "mark what
   happened" and then shows Replan as the loudest thing on screen.
8. **The error on `/import` appears below the Apple help box**
   (`import/page.tsx:201-206`), 150px from the field that caused it.
9. **Setup hides its own primary action.** "Plan my week" is the last thing on
   a 2,000px page; the most prominent buttons above it are "Import a
   calendar" and three accent-filled day toggles (`setup/page.tsx:117`,
   `:303`).
10. **The + and the undo toast cannot be found on a phone**, see bug 1.
