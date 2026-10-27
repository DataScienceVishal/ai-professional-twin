import { act, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import Home from './home'

// framer-motion reads the reduced-motion preference once per module load, so
// this check lives in its own file, where nothing has rendered before it.
afterEach(() => {
  vi.unstubAllGlobals()
})

it('lets answers enter without motion when the visitor asks for reduced motion', async () => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, json: async () => ({}) } as Response)))
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
  render(<Home />)
  // Read the first paint: a fade starts at 0 and may have finished by the next tick.
  expect(screen.getByTestId('answer').style.opacity).toBe('1')
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
})
