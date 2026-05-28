import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Image Generation API | OMA AI',
  description: 'Generate images with AI using the OMA API. Support for FLUX.1, DALL-E 3, and more. Pay with crypto.',
  keywords: ['AI image generation', 'FLUX', 'DALL-E', 'text to image', 'AI API'],
  openGraph: {
    title: 'Image Generation API | OMA AI',
    description: 'Generate images with AI. Access FLUX.1 and other models via API.',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Image Generation API | OMA AI',
    description: 'Generate images with AI via API.',
    images: ['/og-image.png'],
  },
}

export default function ImageGenerationLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
