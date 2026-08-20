import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

/**
 * The app icon, generated rather than shipped as a binary.
 *
 * A calendar column with one filled block — the single idea the product is
 * about: not what's due, but which hour it happens in.
 */
export default function Icon() {
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
        <div style={{ display: 'flex', gap: 26 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                width: 78,
              }}
            >
              {[0, 1, 2, 3].map((j) => {
                const filled = (i === 1 && j === 1) || (i === 2 && j === 2);
                return (
                  <div
                    key={j}
                    style={{
                      height: filled ? 96 : 44,
                      borderRadius: 14,
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
