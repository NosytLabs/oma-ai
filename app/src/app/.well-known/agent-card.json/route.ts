import { NextResponse } from 'next/server'

export const dynamic = 'force-static'
export const revalidate = 3600

export async function GET() {
  const agentCard = {
    name: 'OMA AI Gateway',
    description: 'Permissionless AI inference across 17+ models. Pay per request in USDC via x402.',
    url: 'https://oma-ai.com/.well-known/agent-card.json',
    version: '2.0.0',
    capabilities: { streaming: true, pushNotifications: false, stateTransitionHistory: false },
    authentication: { schemes: ['x402', 'siwe'] },
    defaultInputModes: ['text'],
    defaultOutputModes: ['text', 'application/a2ui+json'],
    skills: [
      { id: 'chat-completions', name: 'Chat Completions', description: 'OpenAI-compatible chat completions' },
      { id: 'image-generation', name: 'Image Generation', description: 'Text-to-image generation' },
      { id: 'video-generation', name: 'Video Generation', description: 'Text-to-video and image-to-video' },
      { id: 'web-search', name: 'Web Search', description: 'Web search via Tinyfish MCP' },
    ],
  }
  return NextResponse.json(agentCard, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}