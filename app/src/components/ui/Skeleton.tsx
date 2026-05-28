'use client'

import { useEffect, useState } from 'react'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
  animation?: 'pulse' | 'wave' | 'none'
}

export function Skeleton({
  className = '',
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  const variantClasses = {
    text: 'rounded h-3',
    circular: 'rounded-full',
    rectangular: 'rounded',
  }
  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
    none: '',
  }

  return (
    <div
      role="status"
      aria-label="Loading"
      className={`skeleton ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    />
  )
}

export function SkeletonCard({ rows = 4 }: { rows?: number }) {
  return (
    <div
      className="skeleton-card"
      role="presentation"
      aria-label="Loading content"
    >
      <div className="flex items-center gap-4 mb-4">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="40%" height={12} />
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} variant="text" width={`${100 - i * 10}%`} />
        ))}
      </div>
    </div>
  )
}

export function SkeletonTableRow({ columns = 4 }: { columns?: number }) {
  return (
    <tr className="border-b border-border animate-pulse">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="py-4 px-5">
          <Skeleton
            variant="text"
            width={`${Math.random() * 40 + 60}%`}
            className={i === columns - 1 ? 'ml-auto' : ''}
          />
        </td>
      ))}
    </tr>
  )
}

export function SkeletonStatsCard() {
  return (
    <div
      className="border border-border bg-panel p-6 text-center animate-pulse"
      role="presentation"
      aria-label="Loading statistics"
    >
      <Skeleton variant="text" width="40px" height={36} className="mx-auto mb-2" />
      <Skeleton variant="text" width="80px" />
    </div>
  )
}

export function SkeletonCodeBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div
      className="border border-border bg-panel p-6 rounded-lg font-mono animate-pulse"
      role="presentation"
      aria-label="Loading code"
    >
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="mb-2">
          <Skeleton variant="text" width={`${100 - i * 15}%`} />
        </div>
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-panel">
      <div className="border-b border-border bg-gradient-to-r from-indigo-500/5 to-purple-500/5 px-6 py-4">
        <div className="flex gap-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <table className="w-full">
        <tbody className="divide-y divide-border/50">
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="flex gap-4 px-6 py-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-20" />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function SkeletonKeyList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card flex items-center gap-4 py-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonEmptyState({ message = 'No data yet' }: { message?: string }) {
  return (
    <div className="card flex items-center justify-center py-12">
      <div className="text-center">
        <Skeleton className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <span className="text-sm text-text-secondary">{message}</span>
      </div>
    </div>
  )
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      role="presentation"
      aria-label="Loading items"
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} rows={3} />
      ))}
    </div>
  )
}

export function SkeletonStatsRow() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-6">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  )
}

export function NavbarSkeleton() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div
      className="sticky top-0 left-0 right-0 z-50 bg-void/80 backdrop-blur-md border-b border-border/80 font-mono"
      role="presentation"
      aria-label="Loading navigation"
    >
      <div className="w-full px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <Skeleton variant="rectangular" width={80} height={24} />
            <div className="hidden lg:flex items-center gap-5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} variant="text" width={60} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Skeleton variant="rectangular" width={100} height={36} />
            <Skeleton variant="rectangular" width={40} height={40} />
          </div>
        </div>
      </div>
    </div>
  )
}