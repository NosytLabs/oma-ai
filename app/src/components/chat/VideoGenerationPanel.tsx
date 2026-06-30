'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Sparkles, Loader2, Download, Film, Image as ImageIcon, Plus } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { FileUpload } from '@/components/ui/FileUpload'
import { buildAuthHeaders } from '@/lib/cookies'

interface VideoModel {
  id: string
  name: string
  provider: string
  mode: 'text-to-video' | 'image-to-video'
  price: number
}

const VIDEO_MODELS: VideoModel[] = [
  { id: 'seedance-2-0-text-to-video', name: 'Seedance 2.0', provider: 'Venice AI', mode: 'text-to-video', price: 0.90 },
  { id: 'kling-v3-pro-text-to-video', name: 'Kling V3 Pro', provider: 'Venice AI', mode: 'text-to-video', price: 0.92 },
  { id: 'kling-v3-pro-image-to-video', name: 'Kling V3 Pro (Image)', provider: 'Venice AI', mode: 'image-to-video', price: 0.92 },
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

export function VideoGenerationPanel() {
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
  const [queuePosition, setQueuePosition] = useState<number>(0)
  const [eta, setEta] = useState<string>('')
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const toast = useToast()

  const availableModels = useMemo(() =>
    mode === 'text-to-video'
      ? VIDEO_MODELS.filter(m => m.mode === 'text-to-video')
      : VIDEO_MODELS.filter(m => m.mode === 'image-to-video'),
    [mode]
  )

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
    if (pollingRef.current) clearInterval(pollingRef.current)
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
        const resp = await fetch(`${RETRIEVE_URL}?queue_id=${qId}`, {
          credentials: 'include',
          headers: buildAuthHeaders({ Accept: 'application/json' }),
        })

        if (resp.status === 401) {
          if (pollingRef.current) clearInterval(pollingRef.current)
          setPolling(false)
          setLoading(false)
          toast.error('API key expired or invalid. Please check your credentials.')
          return
        }
        if (!resp.ok) return

        const json = await resp.json()
        if (json.status === 'completed' && json.video_url) {
          if (pollingRef.current) clearInterval(pollingRef.current)
          setVideoUrl(json.video_url)
          setPolling(false)
          setLoading(false)
          toast.success('Video generated successfully!')
        } else {
          if (json.queue_position !== undefined) setQueuePosition(json.queue_position)
          if (json.eta) setEta(json.eta)
          else if (json.queue_position > 0) setEta(`~${json.queue_position * 30}s`)
        }
      } catch {
        // retry
      }
    }, 3000)
  }, [toast])

  const generate = useCallback(async () => {
    if (!prompt.trim() || loading) return

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
        credentials: 'include',
        headers: buildAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(body),
      })

      if (resp.status === 401) {
        throw new Error('Connect your wallet to generate an API key')
      }
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
    setQueuePosition(0)
    setEta('')
  }, [])

  const selectedModel = VIDEO_MODELS.find(m => m.id === model)

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="mb-2 text-sm font-medium text-accent">OMA AI Gateway</div>
        <h1 className="h1-utility text-text-bright">
          Video Generation
        </h1>
        <p className="mt-3 text-lg text-text-bright">
          Generate videos from text prompts. Powered by Seedance 2.0 and Kling V3 Pro. Priced per generation —{' '}
          <span className="text-accent">from $0.90</span>.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="mb-6 flex rounded-xl bg-surface p-1" role="tablist" aria-label="Video generation mode">
          <button type="button"
            onClick={() => setMode('text-to-video')}
            role="tab"
            aria-selected={mode === 'text-to-video'}
            aria-controls="prompt-panel"
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-inset ${
mode === 'text-to-video'
                ? 'bg-surface text-text shadow-sm border border-accent'
                : 'text-text hover:text-accent hover:bg-border/50'
            }`}
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" /> Text to Video
          </button>
          <button type="button"
            onClick={() => setMode('image-to-video')}
            role="tab"
            aria-selected={mode === 'image-to-video'}
            aria-controls="prompt-panel"
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-inset ${
mode === 'image-to-video'
                ? 'bg-surface text-text shadow-sm border border-accent'
                : 'text-text hover:text-accent hover:bg-border/50'
            }`}
          >
            <ImageIcon className="w-4 h-4" aria-hidden="true" /> Image to Video
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4" id="prompt-panel" role="tabpanel">
            <div>
              <label htmlFor="video-prompt" className="mb-2 block text-sm font-semibold text-text-bright">Prompt</label>
              <textarea
                id="video-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the video you want to generate..."
                rows={4}
                className="w-full resize-none focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
                disabled={loading || polling}
                aria-required="true"
              />
            </div>

            {mode === 'image-to-video' && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-text-bright">Source Image</label>
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
              <label htmlFor="vid-model-select" className="mb-2 block text-sm font-semibold text-text-bright">Model</label>
              <select
                id="vid-model-select"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={loading || polling}
                className="w-full disabled:opacity-50"
              >
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} (${m.price.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="vid-aspect-select" className="mb-2 block text-sm font-semibold text-text-bright">Aspect Ratio</label>
              <div className="flex gap-1.5">
                {ASPECT_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setAspectRatio(o.value)}
                    aria-pressed={aspectRatio === o.value}
                    className={`flex flex-col items-center gap-1 flex-1 rounded-lg border py-2.5 px-2 transition-all ${
                      aspectRatio === o.value
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border bg-surface text-text-secondary hover:border-accent/40'
                    }`}
                  >
                    <div
                      className="rounded-sm border border-current opacity-60"
                      style={{
                        width: o.value === '16:9' ? '28px' : o.value === '9:16' ? '14px' : '22px',
                        height: o.value === '16:9' ? '16px' : o.value === '9:16' ? '24px' : '22px',
                      }}
                    />
                    <span className="text-[10px] font-mono">{o.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="vid-duration-select" className="mb-2 block text-sm font-semibold text-text-bright">Duration</label>
              <select
                id="vid-duration-select"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                disabled={loading || polling}
                className="w-full disabled:opacity-50"
              >
                {DURATION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="vid-resolution-select" className="mb-2 block text-sm font-semibold text-text-bright">Resolution</label>
              <select
                id="vid-resolution-select"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                disabled={loading || polling}
                className="w-full disabled:opacity-50"
              >
                {RESOLUTION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button type="button"
            onClick={generate}
            disabled={!prompt.trim() || loading || polling}
            className="btn-primary w-full sm:w-auto justify-center"
            aria-label={loading ? 'Submitting video generation job' : polling ? 'Processing video generation' : 'Generate video from prompt'}
          >
            {loading ? (
              <><Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> Submitting...</>
            ) : polling ? (
              <><Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> Processing...</>
            ) : (
              <><Sparkles className="w-5 h-5" aria-hidden="true" /> Generate Video</>
            )}
          </button>
          {(videoUrl || queueId) && (
            <button type="button" onClick={reset} className="btn-secondary w-full sm:w-auto justify-center" aria-label="Start new video generation">
              <Plus className="w-4 h-4" aria-hidden="true" /> New
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-xl border px-4 py-3 text-sm border-error bg-error/10 text-error" role="alert">
            {error}
          </div>
        )}

        {selectedModel && (
          <div className="mt-4 text-xs text-text">
            Cost: ${selectedModel.price.toFixed(2)} per generation
          </div>
        )}
      </div>

      {loading && !polling && (
        <div className="mt-8 rounded-2xl border border-border bg-surface p-12 shadow-sm">
          <div className="flex flex-col items-center justify-center text-center">
            <Loader2 className="w-10 h-10 text-accent animate-spin mb-4" />
            <p className="text-lg font-semibold text-text-bright">Submitting video generation job...</p>
            <p className="text-sm text-text">This may take a moment.</p>
          </div>
        </div>
      )}

      {polling && (
        <div className="mt-8 rounded-2xl border border-border bg-surface p-12 shadow-sm">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="relative mb-6">
              <Loader2 className="w-16 h-16 text-accent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Film className="w-6 h-6 text-accent" />
              </div>
            </div>
            <p className="text-lg font-semibold text-text-bright">Generating your video...</p>
            <p className="mt-2 text-sm text-text">
              This usually takes 30-60 seconds. Stay on this page and the video will appear automatically.
            </p>
            <div className="mt-4 flex items-center gap-4 text-xs font-mono text-text-muted">
              {queuePosition > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="text-accent tabular-nums">#{queuePosition}</span>
                  in queue
                </span>
              )}
              {eta && (
                <span className="flex items-center gap-1.5">
                  <span className="text-accent tabular-nums">{eta}</span>
                  ETA
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {videoUrl && !loading && !polling && (
        <div className="mt-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-bright">Your Video</h2>
            <button type="button" onClick={downloadVideo} className="btn-secondary w-full sm:w-auto justify-center" aria-label="Download generated video">
              <Download className="w-4 h-4" aria-hidden="true" /> Download
            </button>
          </div>
          <div className="rounded-2xl overflow-hidden border border-border bg-void shadow-sm">
            <video controls autoPlay className="w-full max-h-[600px]" aria-label="Generated video preview">
              <source src={videoUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      )}

      {!loading && !polling && !videoUrl && !error && (
        <div className="mt-16 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center mb-6 shadow-xl">
            <Film className="w-10 h-10 text-text-inverse" />
          </div>
          <h2 className="h2-page text-text-bright mb-2">Describe the video you want</h2>
          <p className="text-text max-w-md">
            Write a detailed prompt describing the scene, motion, and style. You can also upload an image to animate it.
          </p>
        </div>
      )}
    </div>
  )
}
