import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Heron: a plan that survives you falling behind';

/**
 * The link preview.
 *
 * Generated rather than shipped as a binary, the same way `icon.tsx` is, so it
 * cannot drift from the palette and there is no asset to forget to update.
 *
 * **Why this exists at all.** Distribution is one student texting another a
 * link. With no OG image, iMessage and Instagram render `heron.study` as a bare
 * blue URL, which from a stranger reads as spam. For most students this image
 * is the first impression, not the landing page.
 *
 * **Why it draws a week rather than a logo.** The pitch that lands is "your
 * work, placed in real hours", and a logo says nothing about that. This is the
 * same idea as the week sketch on `/welcome`: show the artifact, because people
 * hearing a description of a scheduler picture a calendar app they already own.
 *
 * Hex values are inlined deliberately. An OG image is rendered on a server with
 * no CSS custom properties and no theme, so `var(--cat-deadline-0)` would
 * silently render as nothing.
 */

const INK = '#f2eee9';
const BG = '#121110';
const SURFACE = '#1b1917';
const MUTED = '#a8a29b';
const ACCENT = '#e0894f';

/**
 * A plausible week, not a decorative one.
 *
 * The first version put every block in the top third of the column, which read
 * as "a mostly empty week" at a glance: the opposite of the claim. Tops are
 * spread across the full column so a thumbnail in a text message reads as a
 * real day, morning through evening.
 *
 * Dark-mode canonical shades: class blue, deadline red, focus purple, work
 * teal, personal green.
 */
const CLASS = '#437fc9';
const DEADLINE = '#d55753';
const FOCUS = '#d39aed';
const WORK = '#53ecdc';
const PERSONAL = '#66ac69';

const BLOCKS: Array<{ day: number; top: number; height: number; fill: string }> = [
  { day: 0, top: 6, height: 54, fill: CLASS },
  { day: 0, top: 70, height: 46, fill: DEADLINE },
  { day: 0, top: 148, height: 62, fill: FOCUS },
  { day: 0, top: 236, height: 58, fill: WORK },

  { day: 1, top: 34, height: 40, fill: FOCUS },
  { day: 1, top: 96, height: 72, fill: WORK },
  { day: 1, top: 196, height: 54, fill: DEADLINE },

  { day: 2, top: 6, height: 54, fill: CLASS },
  { day: 2, top: 78, height: 50, fill: FOCUS },
  { day: 2, top: 150, height: 44, fill: DEADLINE },
  { day: 2, top: 216, height: 78, fill: WORK },

  { day: 3, top: 26, height: 66, fill: DEADLINE },
  { day: 3, top: 110, height: 48, fill: FOCUS },
  { day: 3, top: 182, height: 40, fill: CLASS },
  { day: 3, top: 244, height: 50, fill: PERSONAL },

  { day: 4, top: 6, height: 54, fill: CLASS },
  { day: 4, top: 74, height: 58, fill: FOCUS },
  { day: 4, top: 152, height: 44, fill: DEADLINE },

  { day: 5, top: 60, height: 52, fill: PERSONAL },
  { day: 5, top: 132, height: 76, fill: FOCUS },

  { day: 6, top: 98, height: 64, fill: FOCUS },
  { day: 6, top: 180, height: 44, fill: PERSONAL },
];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', background: BG,
          padding: 72, alignItems: 'center', gap: 64,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', width: 560 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end' }}>
              <div style={{ width: 9, height: 22, background: ACCENT, borderRadius: 2 }} />
              <div style={{ width: 9, height: 34, background: ACCENT, borderRadius: 2 }} />
            </div>
            <div style={{ fontSize: 30, color: INK, fontWeight: 600 }}>Heron</div>
          </div>

          <div style={{ fontSize: 60, color: INK, fontWeight: 600, lineHeight: 1.08, letterSpacing: -1.5 }}>
            A plan that survives
          </div>
          <div style={{ fontSize: 60, color: ACCENT, fontWeight: 600, lineHeight: 1.08, letterSpacing: -1.5 }}>
            you falling behind.
          </div>

          <div style={{ fontSize: 25, color: MUTED, marginTop: 26, lineHeight: 1.4 }}>
            Your work placed in real hours, around class,
          </div>
          <div style={{ fontSize: 25, color: MUTED, lineHeight: 1.4 }}>
            work and sleep. Free, no account needed.
          </div>
        </div>

        {/* The artifact, not a logo. Same argument as the welcome carousel. */}
        <div
          style={{
            display: 'flex', flexDirection: 'column', flex: 1,
            background: SURFACE, borderRadius: 20, padding: 22,
          }}
        >
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <div
                key={i}
                style={{
                  flex: 1, textAlign: 'center', fontSize: 15, color: MUTED,
                  display: 'flex', justifyContent: 'center',
                }}
              >
                {d}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, height: 300, position: 'relative' }}>
            {[0, 1, 2, 3, 4, 5, 6].map((day) => (
              <div key={day} style={{ flex: 1, background: '#232120', borderRadius: 8, position: 'relative', display: 'flex' }}>
                {BLOCKS.filter((b) => b.day === day).map((b, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'absolute', left: 4, right: 4, top: b.top,
                      height: b.height, background: b.fill, borderRadius: 5,
                      display: 'flex',
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
