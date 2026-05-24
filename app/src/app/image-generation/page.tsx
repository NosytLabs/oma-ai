'use client'

import { useState, useCallback } from 'react'
import { Sparkles, Download, Image as ImageIconComponent, Loader2, Plus } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import Image from 'next/image'

const IMAGE_MODELS = [
  { id: 'sdxl', name: 'SDXL' },
  { id: 'flux-schnell', name: 'Flux Schnell' },
  { id: 'flux-pro', name: 'Flux Pro' },
  { id: 'stable-diffusion-3.5', name: 'Stable Diffusion 3.5' },
]

const SIZE_OPTIONS = [
  { label: 'Square', value: '1024x1024' },
  { label: 'Portrait', value: '1024x1536' },
  { label: 'Landscape', value: '1536x1024' },
  { label: 'Small Square', value: '512x512' },
]

const API_URL = '/api/v1/images/generations'

export default function ImageGenerationPage() {
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('sdxl')
  const [size, setSize] = useState('1024x1024')
  const [count, setCount] = useState(1)
  const [loading, setLoading] = useState(false)
  const [images, setImages] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  const generate = useCallback(async () => {
    if (!prompt.trim() || loading) return

    const apiKey = // Uses raw API key (oma_api_key_raw) rather than session token (oma_session)
// because this page directly authenticates with the server-side API endpoint
localStorage.getItem('oma_api_key_raw')
    if (!apiKey) {
      toast.error('Enter your API key in Settings first')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const resp = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, prompt: prompt.trim(), n: count, size }),
      })

      if (!resp.ok) {
        const errBody = await resp.json().catch(() => null)
        throw new Error(errBody?.error?.message || `HTTP ${resp.status}`)
      }

      const json = await resp.json()
      const urls = (json.data || []).map((d: { url: string }) => d.url)
      setImages(urls)
      if (urls.length > 0) toast.success(`Generated ${urls.length} image${urls.length > 1 ? 's' : ''}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [prompt, model, count, size, loading, toast])

  const downloadImage = useCallback(async (url: string, index: number) => {
    try {
      const resp = await fetch(url)
      const blob = await resp.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `oma-image-${Date.now()}-${index + 1}.png`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      toast.error('Failed to download image')
    }
  }, [toast])

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="mb-2 text-sm font-medium text-indigo-600">OMA AI Gateway</div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Image Generation
          </h1>
          <p className="mt-3 text-lg text-slate-600">
            Generate images from text prompts. Powered by Venice AI. 5 credits per image.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Prompt</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="A serene mountain lake at sunset, digital art..."
                  rows={4}
                  className="w-full resize-none"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Model</label>
                <select value={model} onChange={(e) => setModel(e.target.value)} disabled={loading}>
                  {IMAGE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Size</label>
                <select value={size} onChange={(e) => setSize(e.target.value)} disabled={loading}>
                  {SIZE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label} ({o.value})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Count</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => setCount(n)}
                      disabled={loading}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        count === n
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={generate}
              disabled={!prompt.trim() || loading}
              className="btn-primary"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="w-5 h-5" /> Generate</>
              )}
            </button>
            {images.length > 0 && (
              <button
                onClick={() => { setImages([]); setPrompt(''); setError(null) }}
                className="btn-secondary"
              >
                <Plus className="w-4 h-4" /> New
              </button>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-600">
              {error}
            </div>
          )}
        </div>

        {loading && (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} className="aspect-square rounded-2xl skeleton" />
            ))}
          </div>
        )}

        {images.length > 0 && !loading && (
          <div className="mt-8">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Results</h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {images.map((url, i) => (
                <div key={i} className="group relative rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm aspect-square">
                  <Image src={url} alt={`Generated ${i + 1}`} fill className="object-cover" unoptimized />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => downloadImage(url, i)}
                      className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-lg hover:bg-slate-100 transition-all"
                    >
                      <Download className="w-4 h-4" /> Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && images.length === 0 && !error && (
          <div className="mt-16 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center mb-6 shadow-xl">
              <ImageIconComponent className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Describe what you want to see</h2>
            <p className="text-slate-500 max-w-md">
              Enter a detailed prompt above and click Generate. Try including style, lighting, and composition details.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
