import { PlaygroundLoaderLottie } from './_components/PlaygroundLoaderLottie'

export default function Loading() {
  return (
    <div className="min-h-dvh flex flex-col bg-[var(--color-void)]">
      <div className="flex-none border-b border-[var(--color-border)] p-4">
        <div className="h-6 w-32 bg-[var(--color-surface)] animate-pulse" />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <PlaygroundLoaderLottie />
        <div className="text-[var(--color-text-muted)] font-mono text-xs uppercase tracking-widest animate-pulse">
          <span className="inline-block h-2 w-2 bg-[var(--color-accent)] mr-2 animate-pulse" />
          INITIALIZING_PLAYGROUND…
        </div>
      </div>
    </div>
  )
}
