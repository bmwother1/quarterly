# Heron

A free study scheduler for university students. Reads Canvas deadlines, learns
when the student actually has time, plans a week of study blocks, and rebuilds it
when they fall behind. UW first. Launching **September 30 2026**.

Built by Brydon, ECE senior at UW, solo and AI-assisted. He already ships
Next.js, TypeScript, Supabase, Tailwind, shadcn/ui and Vercel on another product,
so skip stack explanations and explain what's specific to this project.

House style, his rules: direct recommendation not a menu, concrete commands not
plans, concise, no preamble or self-summary, **no em dashes**, no AI filler. Say
when an idea is bad before writing the code.

## This file is the index. Read further only when it's relevant.

| Working on… | Read |
|---|---|
| Code | `context/status.md`, then `context/decisions.md` |
| "Why is it built this way?" | `context/decisions.md` |
| "Should we build X?" | `context/product.md`, `context/decisions.md` |
| Pitch, application, copy | `context/product.md`, `context/learned.md` |
| Picking up after a break | `context/status.md`, `context/sessions.md` |
| "What are we building next?" | `context/roadmap.md` |
| Who Brydon is | `context/founder.md` |

`context/README.md` explains the system and how to update it. Run `/wrap` at the
end of a working session.

## Running things

Node 24 is installed user-local and **is not on the default PATH**:

```
export PATH="$HOME/.local/node/bin:$PATH"
```

```
npm run dev        the web app
npm test           181 tests, no framework
npm run check      typecheck + lint + tests
npm run week       print a planned week from a Canvas feed
npm run my-week    print Brydon's real week — the off-season case
npm run first-run  print what a brand-new student gets from /start
npm run handoff    regenerate the Cowork brief
```

**Those three print-a-real-week scripts have each found a bug no test caught.**
Run them after any scheduler change and read the output. Tests confirm what you
already thought to check; the expensive bugs live in what you didn't.

## Standing rules

- **The scheduler stays deterministic.** No LLM in the scheduling path — it makes
  a student's week reshuffle on refresh, and they stop trusting it.
- **Never commit a Canvas feed URL.** It's a password: anyone holding it can read
  a real student's whole schedule.
- **Test the plausible mistake, not the happy path.** In this project the failure
  mode has consistently been code that runs cleanly and is quietly wrong.
- **Don't claim grade improvements.** The classroom evidence doesn't support it.
- Domain layer (`src/lib/`) stays dependency-free and React-free so it runs in the
  terminal, in tests, and in the browser unchanged.

@AGENTS.md
