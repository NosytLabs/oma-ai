import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Video Generation API | OMA AI',
  description: 'Generate videos with AI using the OMA API. Support for Seedance, Kling, and more. Pay with crypto.',
  keywords: ['AI video generation', 'text to video', 'AI video', 'Seedance', 'Kling', 'AI API'],
  openGraph: {
    title: 'Video Generation API | OMA AI',
    description: 'Generate videos with AI. Access Seedance and other models via API.',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Video Generation API | OMA AI',
    description: 'Generate videos with AI via API.',
    images: ['/og-image.png'],
  },
}

export default function VideoGenerationLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
