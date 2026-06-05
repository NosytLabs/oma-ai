'use client'

import { createContext, useContext, useState, useCallback, useId, useEffect, useRef, ReactNode } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { X, CheckCircle2, AlertTriangle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const prefersReducedMotion = useReducedMotion() ?? false
  // React 19 useId hook for unique ID generation
  const uniqueId = useId()
  // Track auto-dismiss timers so we can clear them on manual dismiss / unmount
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    // Use cryptographically secure ID generation
    const id = `${uniqueId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
    setToasts((prev) => [...prev, { id, message, type }])

    // Auto-dismiss after 4 seconds (timer tracked so manual dismiss can cancel it)
    const timeoutId = setTimeout(() => {
      timersRef.current.delete(id)
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
    timersRef.current.set(id, timeoutId)
  }, [uniqueId])

  // Clear all pending timers when the provider unmounts
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((t) => clearTimeout(t))
      timers.clear()
    }
  }, [])

  const success = useCallback((message: string) => toast(message, 'success'), [toast])
  const error = useCallback((message: string) => toast(message, 'error'), [toast])
  const info = useCallback((message: string) => toast(message, 'info'), [toast])

  return (
    <ToastContext.Provider value={{ toast, success, error, info }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2" role="region" aria-label="Notifications">
        <AnimatePresence>
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} prefersReducedMotion={prefersReducedMotion} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss, prefersReducedMotion }: { toast: Toast; onDismiss: () => void; prefersReducedMotion?: boolean | null }) {
  const motionPrefersReducedMotion = prefersReducedMotion ?? false
  const icons = {
    success: <CheckCircle2 className="h-5 w-5 text-[var(--color-success)] shrink-0" />,
    error: <AlertTriangle className="h-5 w-5 text-[var(--color-error)] shrink-0" />,
    info: <Info className="h-5 w-5 text-[var(--color-info)] shrink-0" />,
  }

  const styles = {
    success: 'border-[var(--color-success)]/30 bg-[var(--color-success)]/10',
    error: 'border-[var(--color-error)]/30 bg-[var(--color-error)]/10',
    info: 'border-[var(--color-info)]/30 bg-[var(--color-info)]/10',
  }

  const animationVariants = {
    initial: motionPrefersReducedMotion ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 20, scale: 0.95 },
    animate: motionPrefersReducedMotion ? { opacity: 1, y: 0, scale: 1 } : { opacity: 1, y: 0, scale: 1 },
    exit: motionPrefersReducedMotion ? { opacity: 0, x: 0, scale: 1 } : { opacity: 0, x: 100, scale: 0.95 },
  }

  return (
    <motion.div
      initial={animationVariants.initial}
      animate={animationVariants.animate}
      exit={animationVariants.exit}
      transition={motionPrefersReducedMotion ? { duration: 0 } : undefined}
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm min-w-[280px] max-w-[400px] ${styles[toast.type]}`}
    >
      {icons[toast.type]}
      <span className="flex-1 text-sm font-medium text-[var(--color-text)]">{toast.message}</span>
      <button
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="rounded-lg min-h-11 min-w-11 flex items-center justify-center p-1 hover:bg-white/10 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
      >
        <X className="h-4 w-4 text-[var(--color-text-secondary)]" />
      </button>
    </motion.div>
  )
}
