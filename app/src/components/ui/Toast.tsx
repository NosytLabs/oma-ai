'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
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

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => dismiss(id), 4000)
  }, [dismiss])

  const success = useCallback((message: string) => toast(message, 'success'), [toast])
  const error = useCallback((message: string) => toast(message, 'error'), [toast])
  const info = useCallback((message: string) => toast(message, 'info'), [toast])

  return (
    <ToastContext.Provider value={{ toast, success, error, info }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2" role="status" aria-live="polite">
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
    success: 'border-green-500/30 bg-green-500/10',
    error: 'border-red-500/30 bg-red-500/10',
    info: 'border-indigo-500/30 bg-indigo-500/10',
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
        className="rounded-lg min-h-11 min-w-11 flex items-center justify-center p-1 hover:bg-black/10 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
      >
        <X className="h-4 w-4 text-[var(--color-text-secondary)]" />
      </button>
    </motion.div>
  )
}
