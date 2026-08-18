# Brydon

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
