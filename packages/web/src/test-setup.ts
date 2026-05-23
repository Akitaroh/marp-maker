/**
 * Vitest setup for React Testing Library
 * - jest-dom matchers (toBeInTheDocument, toBeDisabled, etc.)
 * - ResizeObserver polyfill for jsdom (dogfood-fix 1 続編 4: slide scale-to-fit 用)
 */
import '@testing-library/jest-dom/vitest'

// ResizeObserver polyfill: jsdom 未提供
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverMock {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
}
