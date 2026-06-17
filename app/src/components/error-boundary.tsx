'use client'

// NOTE: No `lucide-react` imports in this file. The Next.js 15 dev-mode
// React Refresh + barrel-loader bug (documented at next.config.ts:39-81)
// can crash any client component that imports from `lucide-react` during
// HMR. If the ErrorBoundary itself depended on lucide, its fallback would
// also crash — leaving users with a blank screen instead of "System Fault".
// Glyphs render unconditionally via CSS, so the fallback always shows.
//
// If a future Next.js patch fixes the dev HMR bug, lucide can return here.

import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught:', error, errorInfo)
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-4">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full border border-red/30 bg-red/10"
            role="img"
            aria-label="System fault warning"
          >
            <span aria-hidden="true" className="text-3xl leading-none text-red">⚠</span>
          </div>
          <div className="text-center">
            <h2 className="font-mono text-text text-lg mb-2">System Fault</h2>
            <p className="text-sm text-text-muted max-w-md font-mono">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
          </div>
          <button
            onClick={this.handleReset}
            className="btn-primary flex items-center gap-2"
          >
            <span aria-hidden="true" className="text-base leading-none">↻</span>
            Retry
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary