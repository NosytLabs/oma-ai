import { NextRequest, NextResponse } from 'next/server'

const MCP_VERSION = '1.0.0'
const SERVER_INFO = { name: 'oma-ai-gateway', version: '2.0.0' }

const TOOLS = [
  {
    name: 'list_models',
    description: 'List all available AI models with pricing and capabilities',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'chat_completions',
    description: 'Send a chat completion request to any supported AI model',
    inputSchema: {
      type: 'object',
      properties: {
        model: { type: 'string', description: 'Model ID' },
        messages: { type: 'array', items: { type: 'object' }, description: 'Chat messages' },
        stream: { type: 'boolean', description: 'Enable streaming' },
      },
      required: ['model', 'messages'],
    },
  },
  {
    name: 'get_balance',
    description: 'Get current account credit balance',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_api_keys',
    description: 'List your API keys',
    inputSchema: { type: 'object', properties: {} },
  },
]

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { method, params, id } = body

  if (method === 'initialize') {
    return NextResponse.json({
      jsonrpc: '2.0',
      id,
      result: { protocolVersion: MCP_VERSION, serverInfo: SERVER_INFO, capabilities: { tools: {} } },
    })
  }

  if (method === 'tools/list') {
    return NextResponse.json({ jsonrpc: '2.0', id, result: { tools: TOOLS } })
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params

    if (name === 'list_models') {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const res = await fetch(`${apiUrl}/v1/models`).catch(() => null)
      const models = res ? await res.json() : []
      return NextResponse.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(models, null, 2) }] } })
    }

    if (name === 'chat_completions') {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const res = await fetch(`${apiUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      })
      const data = await res.json()
      return NextResponse.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] } })
    }

    if (name === 'get_balance') {
      return NextResponse.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: 'Connect wallet to see balance' }] } })
    }

    if (name === 'list_api_keys') {
      return NextResponse.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: 'Connect wallet to see API keys' }] } })
    }

    return NextResponse.json({ jsonrpc: '2.0', id, error: { code: -32601, message: `Tool not found: ${name}` } })
  }

  return NextResponse.json({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } })
}

export async function GET() {
  return NextResponse.json({
    name: 'OMA AI MCP Server',
    description: 'MCP server for OMA AI Inference Gateway',
    tools: TOOLS.map(t => t.name),
  })
}