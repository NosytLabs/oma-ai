import { ImageResponse } from 'next/og'
import { MODEL_COUNT } from '@/lib/models-data'

export const runtime = 'edge'
export const alt = 'OMA AI - Permissionless AI inference gateway. Pay per request in USDC.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: 'linear-gradient(135deg, #0a0a0f 0%, #18181f 60%, #3d1505 100%)',
          color: '#f5f5f4',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              fontWeight: 800,
              color: '#0a0a0f',
            }}
          >
            O
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em' }}>OMA AI</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: '-0.04em',
              maxWidth: 1000,
            }}
          >
            Permissionless AI inference
          </div>
          <div
            style={{
              fontSize: 30,
              lineHeight: 1.3,
              color: '#fdba74',
              maxWidth: 900,
            }}
          >
            Pay per request in USDC. ${MODEL_COUNT} models. No account required.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 12,
            fontSize: 22,
            color: '#a0a0a8',
          }}
        >
          <div>Claude</div>
          <div>·</div>
          <div>GPT</div>
          <div>·</div>
          <div>Gemini</div>
          <div>·</div>
          <div>DeepSeek</div>
          <div>·</div>
          <div>Llama</div>
          <div>·</div>
          <div>Grok</div>
        </div>
      </div>
    ),
    { ...size },
  )
}
