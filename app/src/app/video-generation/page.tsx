'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Sparkles, Loader2, Download, Film, Image as ImageIcon, Plus } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { FileUpload } from '@/components/ui/FileUpload'

interface VideoModel {
  id: string
  name: string
  provider: string
  mode: 'text-to-video' | 'image-to-video'
  price: number
}

const VIDEO_MODELS: VideoModel[] = [
  { id: 'seedance-2-0-text-to-video', name: 'Seedance 2.0', provider: 'Venice AI', mode: 'text-to-video', price: 0.90 },
  { id: 'seedance-2-0-image-to-video', name: 'Seedance 2.0 Image', provider: 'Venice AI', mode: 'image-to-video', price: 1.20 },
  { id: 'kling-v3-pro-text-to-video', name: 'Kling V3 Pro', provider: 'Venice AI', mode: 'text-to-video', price: 0.92 },
  { id: 'kling-v3-pro-image-to-video', name: 'Kling V3 Pro Image', provider: 'Venice AI', mode: 'image-to-video', price: 1.40 },
  { id: 'grok-imagine-text-to-video', name: 'Grok Imagine', provider: 'Venice AI', mode: 'text-to-video', price: 0.85 },
]

const ASPECT_OPTIONS = [
  { label: '16:9 Landscape', value: '16:9' },
  { label: '9:16 Portrait', value: '9:16' },
  { label: '1:1 Square', value: '1:1' },
]

const DURATION_OPTIONS = [
  { label: '5 seconds', value: '5s' },
  { label: '10 seconds', value: '10s' },
]

const RESOLUTION_OPTIONS = [
  { label: 'HD (720p)', value: '720p' },
  { label: 'Full HD (1080p)', value: '1080p' },
]

const API_URL = '/api/v1/videos/generations'
const RETRIEVE_URL = '/api/v1/videos/retrieve'

export default function VideoGenerationPage() {
  const [mode, setMode] = useState<'text-to-video' | 'image-to-video'>('text-to-video')
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('seedance-2-0-text-to-video')
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [duration, setDuration] = useState('5s')
  const [resolution, setResolution] = useState('720p')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [queueId, setQueueId] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [polling, setPolling] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const toast = useToast()

  const availableModels = mode === 'text-to-video'
    ? VIDEO_MODELS.filter(m => m.mode === 'text-to-video')
    : VIDEO_MODELS.filter(m => m.mode === 'image-to-video')

  useEffect(() => {
    const firstModel = availableModels[0]
    if (firstModel) setModel(firstModel.id)
    if (mode === 'text-to-video') setImageUrl(null)
  }, [mode, availableModels])

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

  const startPolling = useCallback((qId: string) => {
    setPolling(true)
    let attempts = 0
    const maxAttempts = 40

    pollingRef.current = setInterval(async () => {
      attempts++
      if (attempts >= maxAttempts) {
        if (pollingRef.current) clearInterval(pollingRef.current)
        setPolling(false)
        setLoading(false)
        toast.error('Video generation timed out. Check your queue later.')
        return
      }

      try {
        const apiKey = // Uses raw API key (oma_api_key_raw) rather than session token (oma_session)
// because this page directly authenticates with the server-side API endpoint
localStorage.getItem('oma_api_key_raw')
        const resp = await fetch(`${RETRIEVE_URL}?queue_id=${qId}`, {
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        })

        if (!resp.ok) return

        const json = await resp.json()
        if (json.status === 'completed' && json.video_url) {
          if (pollingRef.current) clearInterval(pollingRef.current)
          setVideoUrl(json.video_url)
          setPolling(false)
          setLoading(false)
          toast.success('Video generated successfully!')
        }
      } catch {
        // retry
      }
    }, 3000)
  }, [toast])

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
    setVideoUrl(null)
    setQueueId(null)

    const body: Record<string, unknown> = {
      model,
      prompt: prompt.trim(),
      aspect_ratio: aspectRatio,
      duration,
      resolution,
    }
    if (imageUrl) body.image_url = imageUrl

    try {
      const resp = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      })

      if (!resp.ok) {
        const errBody = await resp.json().catch(() => null)
        throw new Error(errBody?.error?.message || `HTTP ${resp.status}`)
      }

      const json = await resp.json()
      setQueueId(json.queue_id)
      startPolling(json.queue_id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed'
      setError(msg)
      toast.error(msg)
      setLoading(false)
    }
  }, [prompt, model, aspectRatio, duration, resolution, imageUrl, loading, toast, startPolling])

  const downloadVideo = useCallback(async () => {
    if (!videoUrl) return
    try {
      const resp = await fetch(videoUrl)
      const blob = await resp.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `oma-video-${Date.now()}.mp4`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      toast.error('Failed to download video')
    }
  }, [videoUrl, toast])

  const reset = useCallback(() => {
    setPrompt('')
    setVideoUrl(null)
    setQueueId(null)
    setError(null)
    setImageUrl(null)
  }, [])

  const selectedModel = VIDEO_MODELS.find(m => m.id === model)

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="mb-2 text-sm font-medium text-indigo-600">OMA AI Gateway</div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Video Generation
          </h1>
          <p className="mt-3 text-lg text-slate-600">
            Generate videos from text prompts or images. Powered by Seedance 2.0, Kling V3 Pro, and Grok Imagine.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => setMode('text-to-video')}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                mode === 'text-to-video'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Sparkles className="w-4 h-4" /> Text to Video
            </button>
            <button
              onClick={() => setMode('image-to-video')}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                mode === 'image-to-video'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <ImageIcon className="w-4 h-4" /> Image to Video
            </button>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Prompt</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the video you want to generate..."
                  rows={4}
                  className="w-full resize-none"
                  disabled={loading || polling}
                />
              </div>

              {mode === 'image-to-video' && (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Source Image</label>
                  <FileUpload
                    onFileSelect={(_file, dataUrl) => {
                      setImageUrl(dataUrl)
                    }}
                    onClear={() => { setImageUrl(null) }}
                  />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Model</label>
                <select value={model} onChange={(e) => setModel(e.target.value)} disabled={loading || polling}>
                  {availableModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} (${m.price.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Aspect Ratio</label>
                <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} disabled={loading || polling}>
                  {ASPECT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Duration</label>
                <select value={duration} onChange={(e) => setDuration(e.target.value)} disabled={loading || polling}>
                  {DURATION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Resolution</label>
                <select value={resolution} onChange={(e) => setResolution(e.target.value)} disabled={loading || polling}>
                  {RESOLUTION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={generate}
              disabled={!prompt.trim() || loading || polling}
              className="btn-primary"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</>
              ) : polling ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
              ) : (
                <><Sparkles className="w-5 h-5" /> Generate Video</>
              )}
            </button>
            {(videoUrl || queueId) && (
              <button onClick={reset} className="btn-secondary">
                <Plus className="w-4 h-4" /> New
              </button>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-600">
              {error}
            </div>
          )}

          {selectedModel && (
            <div className="mt-4 text-xs text-slate-400">
              Cost: ${selectedModel.price.toFixed(2)} per generation
            </div>
          )}
        </div>

        {loading && !polling && (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-12 shadow-sm">
            <div className="flex flex-col items-center justify-center text-center">
              <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
              <p className="text-lg font-semibold text-slate-900">Submitting video generation job...</p>
              <p className="text-sm text-slate-500">This may take a moment.</p>
            </div>
          </div>
        )}

        {polling && (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-12 shadow-sm">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="relative mb-6">
                <Loader2 className="w-16 h-16 text-indigo-500 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Film className="w-6 h-6 text-indigo-600" />
                </div>
              </div>
              <p className="text-lg font-semibold text-slate-900">Generating your video...</p>
              <p className="mt-2 text-sm text-slate-500">
                This usually takes 30-60 seconds. Stay on this page and the video will appear automatically.
              </p>
            </div>
          </div>
        )}

        {videoUrl && !loading && !polling && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Your Video</h2>
              <button onClick={downloadVideo} className="btn-secondary">
                <Download className="w-4 h-4" /> Download
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-black shadow-sm">
              <video controls autoPlay className="w-full max-h-[600px]">
                <source src={videoUrl} type="video/mp4" />
              </video>
            </div>
          </div>
        )}

        {!loading && !polling && !videoUrl && !error && (
          <div className="mt-16 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center mb-6 shadow-xl">
              <Film className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Describe the video you want</h2>
            <p className="text-slate-500 max-w-md">
              Write a detailed prompt describing the scene, motion, and style. You can also upload an image to animate it.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
