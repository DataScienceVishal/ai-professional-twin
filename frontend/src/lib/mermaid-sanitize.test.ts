import { describe, expect, it } from 'vitest'
import { sanitizeMermaid } from './mermaid-sanitize'

describe('sanitizeMermaid', () => {
  it('quotes a label containing parentheses', () => {
    // The exact shape the model produced live, which failed to parse and made
    // every diagram fall back to raw source.
    expect(sanitizeMermaid('U[User Query (Frontend)] --> F[Frontend (React 19)]')).toBe(
      'U["User Query (Frontend)"] --> F["Frontend (React 19)"]',
    )
  })

  it('quotes labels containing angle brackets', () => {
    expect(sanitizeMermaid('A[a -> b <c>]')).toBe('A["a -> b <c>"]')
  })

  it('leaves clean labels untouched', () => {
    const src = 'graph TD\n  A[User Query] --> B[Vector Search]'
    expect(sanitizeMermaid(src)).toBe(src)
  })

  it('leaves already-quoted labels untouched', () => {
    const src = 'A["User Query (Frontend)"] --> B["Embed"]'
    expect(sanitizeMermaid(src)).toBe(src)
  })

  it.each([
    ['cylinder', 'DB[(ChromaDB)]'],
    ['subroutine', 'S[[Worker]]'],
    ['parallelogram', 'P[/Input/]'],
    ['trapezoid', 'T[\\Output\\]'],
  ])('does not rewrite the %s shape', (_name, src) => {
    // Quoting these would silently turn a shape into a plain rectangle.
    expect(sanitizeMermaid(src)).toBe(src)
  })

  it('trims whitespace inside a label it rewrites', () => {
    expect(sanitizeMermaid('A[  Embed (azure)  ]')).toBe('A["Embed (azure)"]')
  })

  it('handles a full multi-line diagram, rewriting only what needs it', () => {
    const input = [
      'graph TD',
      '  U[User Query (Frontend)] --> API[FastAPI Backend]',
      '  API --> VS[Vector Search]',
      '  VS --> Emb[Embed (Azure text-embedding-3-small)]',
      '  subgraph Ingestion',
      '    D[Source Docs] --> Chroma[(ChromaDB)]',
      '  end',
    ].join('\n')

    const out = sanitizeMermaid(input)

    expect(out).toContain('U["User Query (Frontend)"]')
    expect(out).toContain('Emb["Embed (Azure text-embedding-3-small)"]')
    expect(out).toContain('API[FastAPI Backend]')
    expect(out).toContain('Chroma[(ChromaDB)]')
    expect(out).toContain('subgraph Ingestion')
  })

  it('is idempotent', () => {
    const once = sanitizeMermaid('A[Query (x)] --> B[Plain]')
    expect(sanitizeMermaid(once)).toBe(once)
  })

  it('does not touch edge labels written with pipes', () => {
    const src = 'A -->|sends (json)| B'
    expect(sanitizeMermaid(src)).toBe(src)
  })
})
