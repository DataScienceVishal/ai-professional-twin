/**
 * Leading characters that mean the brackets are a *shape*, not a plain label:
 * `[(cylinder)]`, `[[subroutine]]`, `[/parallelogram/]`, `[\trapezoid\]`.
 * Quoting those would silently change the rendered shape, so leave them alone.
 */
const SHAPE_PREFIXES = ['(', '[', '/', '\\']

/**
 * Quote Mermaid bracket labels that contain characters its parser chokes on.
 *
 * LLMs reliably emit `A[User Query (Frontend)]`. Mermaid rejects an unquoted
 * `(` inside `[...]` — verified in-browser, the parse error points straight at
 * the parenthesis — so the whole diagram fails and the reader sees raw source
 * instead of a picture. The system prompt now asks for quoted labels, but model
 * compliance is not a guarantee worth betting the feature on, so repair it here
 * as well.
 */
export function sanitizeMermaid(code: string): string {
  return code.replace(/\[([^[\]"]+)\]/g, (match, inner: string) => {
    if (SHAPE_PREFIXES.includes(inner[0])) return match
    if (!/[()<>]/.test(inner)) return match
    return `["${inner.trim()}"]`
  })
}

/** Openers for the diagram types this assistant is asked to produce. */
const DIAGRAM_OPENER =
  /^\s{0,3}(graph\s+(TD|TB|BT|LR|RL)|flowchart\s+(TD|TB|BT|LR|RL)|sequenceDiagram|classDiagram|erDiagram|stateDiagram(-v2)?)\s*$|^\s{0,3}(graph|flowchart)\s+(TD|TB|BT|LR|RL)\s+\S/i

const FENCE = /^\s*(```|~~~)/

/**
 * Wrap a diagram the model forgot to fence in a ```mermaid block.
 *
 * The prompt asks for a fenced block and usually gets one, but compliance is
 * probabilistic — observed live, an answer opened a diagram as bare prose under
 * an "Architecture" heading. Markdown then treats it as a paragraph, collapses
 * every newline to a space, and the reader gets one long unreadable line of
 * `graph TD A[...] --> B[...]`.
 *
 * Repairing the raw markdown rather than the rendered tree is deliberate: by
 * the time react-markdown has built a paragraph the line structure Mermaid
 * needs is already gone.
 */
export function fenceBareMermaid(markdown: string): string {
  const lines = markdown.split('\n')
  const out: string[] = []
  let inFence = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (FENCE.test(line)) {
      inFence = !inFence
      out.push(line)
      continue
    }
    if (inFence || !DIAGRAM_OPENER.test(line)) {
      out.push(line)
      continue
    }

    // Consume the diagram: it runs to the first blank line, since Mermaid
    // statements are newline-separated and never blank-line-separated.
    const block: string[] = [line]
    while (i + 1 < lines.length && lines[i + 1].trim() !== '' && !FENCE.test(lines[i + 1])) {
      block.push(lines[++i])
    }
    out.push('```mermaid', ...block, '```')
  }

  return out.join('\n')
}
