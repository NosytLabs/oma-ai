'use client'

/**
 * ThemeToggle — M2 BLOCKER fix
 *
 * Small icon button (sun/moon) that flips between dark and light themes.
 * Lives in the navbar's right-side action stack. ARIA-labeled for keyboard
 * and screen-reader users.
 *
 * Visual style matches the other icon buttons in `navbar.tsx` (GitHub link,
 * hamburger) — w-8 h-8 rounded-sm, hover lifts to text-bright + surface bg,
 * focus ring in --color-accent.
 */

import { useTheme } from './ThemeProvider'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      aria-pressed={isLight}
      title={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      data-theme-toggle
      className="hidden md:inline-flex items-center justify-center w-11 h-11 rounded-sm text-text-tertiary hover:text-text-bright hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95 transition-all duration-150"
    >
      {isLight ? (
        // Moon — shown when current theme is light; clicking goes back to dark.
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        // Sun — shown when current theme is dark; clicking switches to light.
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="M4.93 4.93l1.41 1.41" />
          <path d="M17.66 17.66l1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="M4.93 19.07l1.41-1.41" />
          <path d="M17.66 6.34l1.41-1.41" />
        </svg>
      )}
    </button>
  )
}
