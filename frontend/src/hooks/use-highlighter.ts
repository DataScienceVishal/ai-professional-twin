import { useEffect, useSyncExternalStore } from 'react'
import type { Options } from 'react-markdown'

type RehypePlugins = NonNullable<Options['rehypePlugins']>

const NONE: RehypePlugins = []

// A whole opening fence line that names a language. rehype-highlight touches
// no other code, and a mermaid block is drawn as a diagram instead. The line
// has to be complete, or a half-streamed "```mer" would count as code.
const HIGHLIGHTABLE_FENCE = /(```|~~~)[ \t]*(?!mermaid\b)[^\s`~][^\n]*\n/

let loading: Promise<void> | undefined
let loaded: RehypePlugins | undefined
const listeners = new Set<() => void>()

export function needsHighlighter(markdown: string): boolean {
  return HIGHLIGHTABLE_FENCE.test(markdown)
}

function loadHighlighter() {
  loading ??= import('rehype-highlight').then(
    ({ default: rehypeHighlight }) => {
      loaded = [rehypeHighlight]
      listeners.forEach((listener) => listener())
    },
    () => {},
  )
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * The rehype plugins for an answer. rehype-highlight brings highlight.js and
 * its grammars, and the first sheet has no code, so it loads the first time an
 * answer has some. Until then, or if it cannot load, the code shows unhighlighted.
 */
export function useHighlighter(markdown: string): RehypePlugins {
  const wanted = needsHighlighter(markdown)
  const plugins = useSyncExternalStore(subscribe, () => loaded)

  useEffect(() => {
    if (wanted) loadHighlighter()
  }, [wanted])

  return (wanted && plugins) || NONE
}
