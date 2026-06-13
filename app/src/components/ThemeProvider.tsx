'use client'

/**
 * ThemeProvider — M2 BLOCKER fix
 *
 * Provides a `useTheme()` hook and persists the user's choice to localStorage.
 * The companion inline `<script>` in `app/src/app/layout.tsx` (see HeadScript)
 * handles the synchronous, pre-hydration `data-theme` attribute set so we
 * never get a flash of the wrong theme on first paint.
 *
 * Design constraints (see .opencode/todo.md S2.1.4 / S2.1.5):
 *   - No system preference detection (OMA is dark-by-default; light is explicit opt-in).
 *   - Dark is the default for fresh users / cleared storage.
 *   - Setting is persisted under localStorage key `oma-theme` ('light' | 'dark').
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'oma-theme'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // localStorage can throw in private mode / sandboxed iframes — fall through
  }
  return 'dark'
}

function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Start as 'dark' on both server and client first render so SSR markup is stable.
  // The inline head script in layout.tsx has already set the real value on
  // <html data-theme="..."> before hydration, so this initial state is purely
  // for the React tree — useEffect below syncs the React state with reality.
  const [theme, setThemeState] = useState<Theme>('dark')

  // On mount, reconcile React state with whatever the inline script applied.
  // Using a microtask-less read so the first paint after hydration matches.
  useEffect(() => {
    const current = readStoredTheme()
    setThemeState(current)
  }, [])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // best-effort persistence; toggle still works in-session
    }
    applyTheme(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }, [theme, setTheme])

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within a <ThemeProvider>')
  }
  return ctx
}

/**
 * HeadScript — exported as a raw HTML string for use inside `<head>`.
 *
 * This script runs synchronously BEFORE React hydrates, so it can set
 * `<html data-theme="light">` before the first paint. Without it, light-theme
 * users would see a dark flash on every page load (FOUC).
 *
 * Kept as a string (not JSX) because it must be inlined into <head> and
 * cannot depend on React/Next hydration. The function form keeps the
 * code co-located with the React provider for auditability.
 */
export const THEME_HEAD_SCRIPT = `(function(){try{var t=localStorage.getItem('oma-theme');if(t==='light'||t==='dark'){if(t==='light'){document.documentElement.setAttribute('data-theme','light');}else{document.documentElement.removeAttribute('data-theme');}}}catch(e){}})();`
