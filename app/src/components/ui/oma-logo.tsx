import React, { useId } from 'react'

export function OmaLogo({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg', className?: string }) {
  const gradientId = useId()
  const sizeMap = {
    sm: { circle: 28, icon: 3, text: 14 },
    md: { circle: 36, icon: 4, text: 18 },
    lg: { circle: 48, icon: 5, text: 24 },
  }
  const s = sizeMap[size]

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      style={{ width: s.circle, height: s.circle }}
      aria-label="OMA - One Man Army // Open Model Access"
      role="img"
    >
      <defs>
        <linearGradient id={`omaGrad${gradientId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00ffc8"/>
          <stop offset="50%" stopColor="#00e6b0"/>
          <stop offset="100%" stopColor="#00b894"/>
        </linearGradient>
        <filter id={`glow${gradientId}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <circle cx="32" cy="32" r="30" fill="#0a0a0f"/>

      <circle cx="32" cy="32" r="26" fill="none" stroke={`url(#omaGrad${gradientId})`} strokeWidth="1" opacity="0.4"/>

      <circle cx="32" cy="32" r="16" fill="none" stroke={`url(#omaGrad${gradientId})`} strokeWidth="2" filter={`url(#glow${gradientId})`}/>

      <circle cx="32" cy="12" r="3" fill="#00ffc8"/>
      <circle cx="32" cy="52" r="3" fill="#00ffc8"/>
      <circle cx="12" cy="32" r="3" fill="#00ffc8"/>
      <circle cx="52" cy="32" r="3" fill="#00ffc8"/>

      <circle cx="19" cy="19" r="2" fill="#00ffc8" opacity="0.6"/>
      <circle cx="45" cy="19" r="2" fill="#00ffc8" opacity="0.6"/>
      <circle cx="19" cy="45" r="2" fill="#00ffc8" opacity="0.6"/>
      <circle cx="45" cy="45" r="2" fill="#00ffc8" opacity="0.6"/>

      <circle cx="32" cy="32" r="4" fill="#00ffc8" filter={`url(#glow${gradientId})`}/>
      <circle cx="32" cy="32" r="2" fill="#0a0a0f"/>
    </svg>
  )
}

export function OmaLogoWithText({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg', className?: string }) {
  const logoSizeMap = {
    sm: { logo: 28, text: 14 },
    md: { logo: 36, text: 18 },
    lg: { logo: 48, text: 24 },
  }
  const s = logoSizeMap[size]

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <OmaLogo size={size} />
      <div className="flex flex-col">
        <span className="font-bold tracking-tight text-[var(--color-text-bright)]" style={{ fontSize: s.text }}>OMA</span>
        <span className="text-[9px] tracking-widest text-[var(--color-text-muted)]" style={{ marginTop: '-2px', background: 'linear-gradient(90deg, #ffb800, #ffd700)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>ONE MAN ARMY</span>
      </div>
    </div>
  )
}

/**
 * Full branding logo with icon, OMA text, and both taglines
 * Best for landing pages, about pages, and hero sections
 */
export function OmaLogoFull({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 80"
      fill="none"
      className={className}
      style={{ width: '100%', maxWidth: '320px', height: 'auto' }}
      aria-label="OMA - One Man Army // Open Model Access"
      role="img"
    >
      <defs>
        <linearGradient id="omaGradFull" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00ffc8"/>
          <stop offset="50%" stopColor="#00e6b0"/>
          <stop offset="100%" stopColor="#00b894"/>
        </linearGradient>
        <linearGradient id="goldGradFull" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ffb800"/>
          <stop offset="100%" stopColor="#ffd700"/>
        </linearGradient>
        <filter id="glowFull" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Icon */}
      <g transform="translate(8, 8)">
        <circle cx="32" cy="32" r="30" fill="#0a0a0f"/>
        
        <circle cx="32" cy="32" r="26" fill="none" stroke="url(#omaGradFull)" strokeWidth="1" opacity="0.4"/>
        <circle cx="32" cy="32" r="18" fill="none" stroke="url(#omaGradFull)" strokeWidth="2" filter="url(#glowFull)"/>
        
        <circle cx="32" cy="10" r="4" fill="#00ffc8"/>
        <circle cx="32" cy="54" r="4" fill="#00ffc8"/>
        <circle cx="10" cy="32" r="4" fill="#00ffc8"/>
        <circle cx="54" cy="32" r="4" fill="#00ffc8"/>
        
        <circle cx="18" cy="18" r="2.5" fill="#00ffc8" opacity="0.6"/>
        <circle cx="46" cy="18" r="2.5" fill="#00ffc8" opacity="0.6"/>
        <circle cx="18" cy="46" r="2.5" fill="#00ffc8" opacity="0.6"/>
        <circle cx="46" cy="46" r="2.5" fill="#00ffc8" opacity="0.6"/>
        
        <circle cx="32" cy="32" r="5" fill="#00ffc8" filter="url(#glowFull)"/>
        <circle cx="32" cy="32" r="2.5" fill="#0a0a0f"/>
      </g>

      {/* OMA Text */}
      <text x="88" y="42" fontFamily="Syne, system-ui, sans-serif" fontWeight="800" fontSize="36" fill="url(#omaGradFull)" letterSpacing="-1">OMA</text>
      
      {/* Tagline 1: One Man Army */}
      <text x="88" y="58" fontFamily="Syne, system-ui, sans-serif" fontWeight="600" fontSize="10" fill="url(#goldGradFull)" letterSpacing="2">ONE MAN ARMY</text>
      
      {/* Tagline 2: Open Model Access */}
      <text x="88" y="72" fontFamily="Syne, system-ui, sans-serif" fontWeight="400" fontSize="8" fill="#a0a0aa" letterSpacing="0.5">OPEN MODEL ACCESS</text>
    </svg>
  )
}