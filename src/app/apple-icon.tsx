import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/**
 * The app icon, generated rather than shipped as a binary.
 *
 * A calendar column with one filled block — the single idea the product is
 * about: not what's due, but which hour it happens in.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#14120f',
        }}
      >
        <div style={{ display: 'flex', gap: 9 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
                width: 27,
              }}
            >
              {[0, 1, 2, 3].map((j) => {
                const filled = (i === 1 && j === 1) || (i === 2 && j === 2);
                return (
                  <div
                    key={j}
                    style={{
                      height: filled ? 34 : 15,
                      borderRadius: 5,
                      background: filled ? '#e0894f' : '#302c26',
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
