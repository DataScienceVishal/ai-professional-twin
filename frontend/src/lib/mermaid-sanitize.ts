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
