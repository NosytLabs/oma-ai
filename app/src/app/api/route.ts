import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    name: 'OMA AI API',
    version: '0.1.0',
    description: 'Permissionless Inference Gateway',
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'https://api.oma-ai.com',
    documentation: '/docs',
    endpoints: {
      chat: '/v1/chat/completions',
      models: '/v1/models',
      health: '/health',
      balance: '/v1/balance',
      deposit: '/v1/deposit',
      pricing: '/pricing',
    },
    status: 'operational',
  })
}
