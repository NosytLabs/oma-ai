import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0a0a0f',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 24,
        }}
      >
        <div style={{ display: 'flex', gap: 9, alignItems: 'center', height: 112 }}>
          <div style={{ width: 18, height: 44, background: '#f97316', borderRadius: 4 }} />
          <div style={{ width: 18, height: 88, background: '#f97316', borderRadius: 4 }} />
          <div style={{ width: 18, height: 112, background: '#f97316', borderRadius: 4 }} />
          <div style={{ width: 18, height: 64, background: '#f97316', borderRadius: 4 }} />
        </div>
      </div>
    ),
    { ...size }
  )
}
