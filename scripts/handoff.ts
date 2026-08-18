/**
 * Generate context/HANDOFF.md — the single file to paste into a Cowork chat.
 *
 * Cowork can't read this repo. Rather than pasting six files (or, worse,
 * re-explaining the project from scratch every time), this composes the parts
 * that a thinking-and-research conversation actually needs: who Brydon is, what
 * the product is, where things stand, the last few sessions, and recent
 * decisions.
 *
 * Deliberately excludes the deep history. Old decisions and the full findings
 * log are for Claude Code, which can read the files directly.
 *
 *   npm run handoff
 */

import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../context/', import.meta.url);
const read = (name: string) => readFileSync(new URL(name, root), 'utf8').trim();

/** Drop a markdown file's H1 and any leading blurb, keeping the body. */
function body(markdown: string): string {
  const lines = markdown.split('\n');
  const start = lines.findIndex((l) => l.startsWith('# '));
  return lines.slice(start + 1).join('\n').trim();
}

/**
 * Take the first `count` `##` sections of a newest-first file.
 *
 * Skips the preamble above the first section, and strips each section's trailing
 * `---` separator — otherwise the rules bleed into the composed document and
 * stack up against the ones this script adds itself.
 */
function firstSections(markdown: string, count: number): string {
  return body(markdown)
    .split(/\n(?=## )/)
    .filter((p) => p.startsWith('## '))
    .slice(0, count)
    .map((p) => p.replace(/\n+---\s*$/, '').trim())
    .join('\n\n');
}

/**
 * Everything under "## Blocked on Brydon". Promoted to the end of the brief,
 * where an ask is least likely to be skimmed past.
 */
function blockedOn(status: string): string {
  const match = /## Blocked on Brydon\n([\s\S]*?)(?=\n## |$)/.exec(status);
  return match ? match[1].trim() : '';
}

/** Drop a `##` section from a document — used to avoid printing one twice. */
function withoutSection(markdown: string, heading: string): string {
  return markdown
    .split(/\n(?=## )/)
    .filter((p) => !p.startsWith(`## ${heading}`))
    .join('\n');
}

const founder = read('founder.md');
const product = read('product.md');
const status = read('status.md');
const sessions = read('sessions.md');
const decisions = read('decisions.md');

const today = new Date().toISOString().slice(0, 10);
const daysToLaunch = Math.round((Date.UTC(2026, 8, 30) - Date.parse(today)) / 86_400_000);

// Written to the reader — a Claude picking this up in a Cowork chat — so the
// voice stays consistent throughout. Brydon pastes it; it isn't him speaking.
const out = `# Quarterly — project brief

*Generated ${today} from the project's \`context/\` files by \`npm run handoff\`.
Don't edit this by hand; edit the source files and regenerate.*

This is the standing context for Quarterly. It covers the person building it,
what's being built, where it stands, and what has already been decided — so a
conversation can start from here instead of from scratch.
${daysToLaunch > 0 ? `\n**${daysToLaunch} days to launch** (September 30 2026).` : ''}

---

# Who you're working with

${body(founder)}

---

# The product

${body(product)}

---

# Where things stand

${withoutSection(body(status), 'Blocked on Brydon')}

---

# Recent sessions

${firstSections(sessions, 3)}

---

# Recent decisions

*Older decisions and the full findings log stay in the repo, in
\`context/decisions.md\` and \`context/learned.md\`. Ask for them if a question
turns on history this brief doesn't cover.*

${firstSections(decisions, 5)}

---

# Currently waiting on Brydon

${blockedOn(status) || '_Nothing blocked._'}
`;

const target = new URL('HANDOFF.md', root);
writeFileSync(target, out);

const lines = out.split('\n').length;
const words = out.split(/\s+/).length;
console.log(`\n  Wrote context/HANDOFF.md — ${lines} lines, ~${words} words, ~${Math.round(words * 1.3)} tokens`);
console.log('  Paste it at the start of a Cowork chat.\n');
