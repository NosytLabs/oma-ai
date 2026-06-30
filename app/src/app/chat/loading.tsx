import { PlaygroundLoaderLottie } from '../playground/_components/PlaygroundLoaderLottie'

export default function Loading() {
  return (
    <div className="min-h-dvh flex flex-col bg-void">
      <div className="flex-none border-b border-border p-4">
        <div className="h-6 w-32 bg-surface animate-pulse" />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <PlaygroundLoaderLottie />
        <div className="text-text-muted font-mono text-xs uppercase tracking-widest animate-pulse">
          <span className="inline-block h-2 w-2 bg-accent mr-2 animate-pulse" />
          INITIALIZING_PLAYGROUND…
        </div>
      </div>
    </div>
  )
}
