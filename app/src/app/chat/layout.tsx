import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'API Chat',
  description: 'Interactive AI chat playground. Test models, compare responses, stream completions. Pay per token with crypto.',
  alternates: { canonical: '/chat' },
  openGraph: {
    title: 'API Chat | OMA AI',
    description: 'Interactive AI chat playground. Test models, compare responses, stream completions.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'OMA AI Gateway' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'API Chat | OMA AI',
    description: 'Interactive AI chat playground. Test models, compare responses.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'OMA AI Gateway' }],
  },
}

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return children
}
