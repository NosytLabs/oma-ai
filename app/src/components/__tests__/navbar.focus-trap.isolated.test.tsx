/**
 * ISOLATED Unit Test for navbar.tsx — mobile menu focus trap
 *
 * Verifies the WCAG-friendly keyboard behavior of the mobile menu:
 *   - Open: initial focus moves into the menu (first focusable)
 *   - Tab at last focusable: wraps to first
 *   - Shift+Tab at first focusable: wraps to last
 *   - Escape: closes the menu and restores focus to the toggle button
 *
 * Heavy dependencies (wallet context, ApiStatus, ThemeToggle, ConnectButton)
 * are mocked because they're not on the path under test.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import type React from 'react'

// next/navigation hooks (used by Navbar via usePathname).
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

// The wallet context the Navbar reads from. We force `isConnected = false` so
// the connect button path is taken (simpler DOM).
vi.mock('@/components/wallet-context', () => ({
  useWallet: () => ({
    evmAddress: undefined,
    isConnected: false,
    disconnect: vi.fn(),
    availableConnectors: [],
    connectEvm: vi.fn(),
  }),
}))

// lucide-react icons are SVG passthroughs; keep the API the same.
// Use importOriginal so every icon used by the navbar (Box, Terminal, Tag,
// FileText, Sparkles, Wand2, etc.) resolves to a real component, then
// override only the handful we assert on directly.
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>()
  const passthrough = (props: React.SVGAttributes<SVGElement>) => <svg {...props} />
  return {
    ...actual,
    Menu: (props: React.SVGAttributes<SVGElement>) => <svg data-testid="menu-icon" {...props} />,
    X: (props: React.SVGAttributes<SVGElement>) => <svg data-testid="x-icon" {...props} />,
    Github: passthrough,
    Settings: (props: React.SVGAttributes<SVGElement>) => <svg data-testid="settings-icon" {...props} />,
  }
})

// Other Navbar children that don't matter for the focus-trap test.
vi.mock('@/components/ui/oma-logo', () => ({
  OmaLogo: () => <span data-testid="oma-logo" />,
}))
vi.mock('../api-status', () => ({
  ApiStatus: () => <span data-testid="api-status" />,
}))
vi.mock('../web3', () => ({
  Web3ConnectButton: () => <button type="button" data-testid="connect-button">Connect</button>,
}))
vi.mock('../ThemeToggle', () => ({
  ThemeToggle: () => <button type="button" data-testid="theme-toggle">Theme</button>,
}))
// Mock @ant-design/web3 — the navbar lazy-loads its ConnectButton via next/dynamic,
// which would otherwise throw WagmiProviderNotFoundError in jsdom.
vi.mock('@ant-design/web3', () => ({
  ConnectButton: () => <button type="button">Connect</button>,
}))

// Mock wagmi directly — ImprovedConnectButton imports `useEnsName`, which
// requires a WagmiProvider context. The component is mocked in spirit above
// (see the Web3ConnectButton mock), but vite's module graph still resolves
// the wagmi import chain at render time. Stubbing the hooks keeps the test
// honest (it still exercises the navbar DOM) without needing a real provider.
vi.mock('wagmi', () => ({
  useEnsName: () => ({ data: undefined }),
  useAccount: () => ({ address: undefined, isConnected: false }),
  useConnect: () => ({ connect: vi.fn(), connectors: [], isPending: false }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
  useChainId: () => 1,
  useSwitchChain: () => ({ switchChain: vi.fn() }),
  useConfig: () => ({}),
  useClient: () => ({}),
  WagmiProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  createConfig: () => ({}),
  http: () => ({}),
}))


import { Navbar } from '../navbar'

// jsdom doesn't implement scrollIntoView / window.matchMedia. Silence the
// warnings so the test output is clean.
beforeEach(() => {
  // Pin desktop view to false-ish is not needed; mobile menu renders regardless
  // because it's gated by `mobileOpen`, not the viewport.
  // (Tailwind responsive classes are stripped at runtime, so the menu's
  // `md:hidden` doesn't actually hide it in jsdom — the menu renders when open.)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function openMenu() {
  const toggle = screen.getByRole('button', { name: /open navigation menu/i })
  fireEvent.click(toggle)
  return toggle
}

describe('Navbar — mobile menu focus trap', () => {
  it('moves focus to the first focusable element when the menu opens', () => {
    render(<Navbar />)
    openMenu()
    const menu = screen.getByRole('dialog', { name: /mobile navigation/i })
    const firstLink = menu.querySelectorAll<HTMLElement>('a[href]')[0]
    expect(document.activeElement).toBe(firstLink)
  })

  it('exposes the menu as a modal dialog (role=dialog, aria-modal=true)', () => {
    render(<Navbar />)
    openMenu()
    const menu = screen.getByRole('dialog', { name: /mobile navigation/i })
    expect(menu).toHaveAttribute('aria-modal', 'true')
    expect(menu).toHaveAttribute('id', 'mobile-menu')
  })

  it('Tab on the last focusable wraps focus to the first', () => {
    render(<Navbar />)
    openMenu()
    const menu = screen.getByRole('dialog', { name: /mobile navigation/i })
    const focusables = menu.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    last.focus()
    expect(document.activeElement).toBe(last)
    fireEvent.keyDown(menu, { key: 'Tab' })
    expect(document.activeElement).toBe(first)
  })

  it('Shift+Tab on the first focusable wraps focus to the last', () => {
    render(<Navbar />)
    openMenu()
    const menu = screen.getByRole('dialog', { name: /mobile navigation/i })
    const focusables = menu.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    first.focus()
    fireEvent.keyDown(menu, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })

  it('Escape closes the menu', () => {
    render(<Navbar />)
    openMenu()
    const menu = screen.getByRole('dialog', { name: /mobile navigation/i })
    fireEvent.keyDown(menu, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: /mobile navigation/i })).toBeNull()
  })

  it('on close, focus is restored to the toggle button', async () => {
    render(<Navbar />)
    const toggle = openMenu()
    // After openMenu, focus has moved into the menu (first link). The trap
    // remembered the toggle as the prior focus owner, and on close the
    // cleanup function should restore it.
    expect(document.activeElement).not.toBe(toggle)
    fireEvent.keyDown(document, { key: 'Escape' })
    // After the focus trap cleanup runs, focus should be restored.
    // Use waitFor to let React process the state update + effect cleanup.
    await waitFor(() => {
      expect(document.activeElement).toBe(toggle)
    })
  })
})
