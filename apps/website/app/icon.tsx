import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#d8f6e7',
          borderRadius: 7,
          color: '#101614',
          fontSize: 13,
          fontWeight: 850,
          letterSpacing: '-0.5px',
        }}
      >
        mx
      </div>
    ),
    { ...size },
  );
}
