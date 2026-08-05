import { describe, expect, it } from 'vitest'
import { fenceBareMermaid, sanitizeMermaid } from './mermaid-sanitize'

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

describe('fenceBareMermaid', () => {
  it('fences a diagram the model forgot to fence', () => {
    // The exact failure seen live: a diagram opened as bare prose under a
    // heading, which markdown then collapsed into one unreadable line.
    const input = ['## Architecture', 'graph TD', '  A["User"] --> B["API"]', '', 'Some prose.'].join('\n')
    expect(fenceBareMermaid(input)).toBe(
      ['## Architecture', '```mermaid', 'graph TD', '  A["User"] --> B["API"]', '```', '', 'Some prose.'].join('\n'),
    )
  })

  it('leaves an already-fenced diagram completely alone', () => {
    const input = ['```mermaid', 'graph TD', '  A --> B', '```'].join('\n')
    expect(fenceBareMermaid(input)).toBe(input)
  })

  it('does not double-fence when a fenced block follows a bare one', () => {
    const input = ['graph TD', '  A --> B', '', '```mermaid', 'flowchart LR', '  C --> D', '```'].join('\n')
    const out = fenceBareMermaid(input)
    expect(out.match(/```mermaid/g)).toHaveLength(2)
    expect(out.match(/```/g)).toHaveLength(4)
  })

  it('ignores diagram keywords inside a normal code block', () => {
    const input = ['```', 'graph TD', '  A --> B', '```'].join('\n')
    expect(fenceBareMermaid(input)).toBe(input)
  })

  it('stops at the blank line, not at the end of the message', () => {
    const input = ['flowchart LR', '  A --> B', '', 'Trailing paragraph that must stay prose.'].join('\n')
    const out = fenceBareMermaid(input)
    expect(out).toContain('```mermaid\nflowchart LR\n  A --> B\n```')
    expect(out).toContain('Trailing paragraph that must stay prose.')
    expect(out).not.toContain('```mermaid\nTrailing')
  })

  it.each(['sequenceDiagram', 'classDiagram', 'erDiagram', 'stateDiagram-v2'])(
    'recognises %s',
    (opener) => {
      expect(fenceBareMermaid(`${opener}\n  A --> B`)).toContain('```mermaid')
    },
  )

  it('leaves ordinary prose untouched', () => {
    const input = 'He built a graph database and a flowchart tool.\n\nNo diagrams here.'
    expect(fenceBareMermaid(input)).toBe(input)
  })

  it('leaves an empty message untouched', () => {
    expect(fenceBareMermaid('')).toBe('')
  })

  it('is idempotent', () => {
    const once = fenceBareMermaid('graph TD\n  A["x (y)"] --> B')
    expect(fenceBareMermaid(once)).toBe(once)
  })
})
