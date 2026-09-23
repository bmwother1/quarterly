/**
 * Course codes are the one thing on a block a student reads by shape. "CHEM
 * 142" split across two lines, or cut to "CHEM 1…", has to be read twice.
 *
 * `keepCodes` joins the letters and number of every code with a non-breaking
 * space, so a code wraps as one word or not at all. `CourseName` also stops
 * a bare code wrapping inside itself. Where a line must be truncated, callers
 * put the code first and let the words after it take the ellipsis.
 */

const CODE = /\b([A-Z&]{2,6}) (\d{3}[A-Z]?)\b/g;
const WHOLE_CODE = /^[A-Z&]{2,6}\s\d{3}[A-Z]?(\s[A-Z]{1,2})?$/;

export function keepCodes(text: string): string {
  return text.replace(CODE, '$1 $2');
}

export function isCourseCode(text: string): boolean {
  return WHOLE_CODE.test(text.trim());
}

export function CourseName({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`${isCourseCode(name) ? 'whitespace-nowrap' : ''} ${className}`}>
      {keepCodes(name)}
    </span>
  );
}
