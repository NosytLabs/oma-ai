import '@testing-library/jest-dom'
import { vi } from 'vitest'

// ponytail: lottie-web calls canvas 2D context methods on mount, which throw
// in jsdom (no canvas backend). Mock the module so component trees with
// <LottiePlayer> or <FeaturedX402Lottie> render a placeholder div instead.
vi.mock('lottie-react', () => ({
  default: () => null,
  useLottie: () => ({ View: () => null }),
  useLottieInteractivity: () => ({}),
}))
vi.mock('@/components/LottiePlayer', () => ({
  LottiePlayer: () => null,
}))
