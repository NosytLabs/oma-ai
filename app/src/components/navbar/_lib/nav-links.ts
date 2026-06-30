import {
  Box,
  Terminal,
  Tag,
  FileText,
  ArrowLeftRight,
  Info,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  desc?: string
}

export interface NavGroup {
  title: string
  caption: string
  links: NavItem[]
}

/** Primary nav — visible at all times on desktop, used in the mobile menu. */
export const primaryLinks: NavItem[] = [
  { href: '/models', label: 'models', icon: Box, desc: 'browse models' },
  { href: '/chat', label: 'chat', icon: Terminal, desc: 'try it live' },
  { href: '/pricing', label: 'pricing', icon: Tag, desc: 'transparent cost' },
  { href: '/docs', label: 'docs', icon: FileText, desc: 'api reference' },
]

/** Tools dropdown — secondary, off the primary path. */
export const toolsLinks: NavItem[] = [
  { href: '/swap', label: 'swap', icon: ArrowLeftRight, desc: 'token exchange' },
  { href: '/about', label: 'about', icon: Info, desc: 'who we are' },
]

/** Misc pages — not in primary nav or tools dropdown, but recognised by the breadcrumb. */
export const miscLinks: NavItem[] = [
  { href: '/faq', label: 'faq', icon: Info, desc: 'faq' },
  { href: '/privacy', label: 'privacy', icon: FileText, desc: 'privacy policy' },
  { href: '/terms', label: 'terms', icon: FileText, desc: 'terms of service' },
  { href: '/playground', label: 'playground', icon: Terminal, desc: 'api playground' },
  { href: '/image-generation', label: 'image-gen', icon: Box, desc: 'image generation' },
  { href: '/video-generation', label: 'video-gen', icon: Box, desc: 'video generation' },
  { href: '/deposit', label: 'deposit', icon: ArrowLeftRight, desc: 'add funds' },
  { href: '/dashboard', label: 'dashboard', icon: Box, desc: 'dashboard' },
  { href: '/settings', label: 'settings', icon: Settings, desc: 'settings' },
]

export const allLinks: NavItem[] = [...primaryLinks, ...toolsLinks, ...miscLinks]

/** Group definitions for the mobile menu cards. */
export const mobileGroups: NavGroup[] = [
  {
    title: 'product',
    caption: 'core surfaces',
    links: primaryLinks,
  },
  {
    title: 'tools',
    caption: 'modality + utility',
    links: toolsLinks,
  },
]

/** Mobile-menu "account" card links. Treated as active when the current
 *  pathname is any of these (used to highlight the card outline). */
export const accountHrefs = ['/dashboard', '/deposit', '/settings', '/docs'] as const

export function isCurrentPath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function sectionLabelFor(pathname: string): string {
  if (pathname === '/' || pathname === '') return 'home'
  const matched = allLinks.find((link) => isCurrentPath(pathname, link.href))
  if (matched) return matched.label.replace(/^\//, '').split('/')[0] ?? 'home'
  // Fallback: extract the first path segment (e.g. '/faq' → 'faq')
  const segment = pathname.split('/').filter(Boolean)[0]
  return segment ?? 'home'
}