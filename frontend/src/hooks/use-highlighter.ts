import { useEffect, useState } from 'react'
import type { Options } from 'react-markdown'

type RehypePlugins = NonNullable<Options['rehypePlugins']>

const NONE: RehypePlugins = []

// An opening fence that names a language. rehype-highlight touches no other
// code, and a mermaid block is drawn as a diagram instead.
const HIGHLIGHTABLE_FENCE = /(```|~~~)[ \t]*(?!mermaid\b)[^\s`~]/

let highlighter: Promise<RehypePlugins> | undefined
let loaded: RehypePlugins | undefined

/** Whether an answer has code that rehype-highlight would mark up. */
export function needsHighlighter(markdown: string): boolean {
  return HIGHLIGHTABLE_FENCE.test(markdown)
}

/**
 * The rehype plugins for an answer. rehype-highlight brings highlight.js and
 * its grammars, and most answers have no code, so it loads the first time an
 * answer does. Until then, or if it cannot load, the code shows unhighlighted.
 */
export function useHighlighter(markdown: string): RehypePlugins {
  const wanted = needsHighlighter(markdown)
  // Once it has loaded, a later answer with code starts out highlighted.
  const [plugins, setPlugins] = useState(() => (wanted && loaded) || NONE)

  useEffect(() => {
    if (!wanted || plugins !== NONE) return
    let cancelled = false
    highlighter ??= import('rehype-highlight').then(({ default: rehypeHighlight }) => (loaded = [rehypeHighlight]))
    highlighter.then(
      (next) => {
        if (!cancelled) setPlugins(next)
      },
      () => {},
    )
    return () => {
      cancelled = true
    }
  }, [wanted, plugins])

  return plugins
}
