import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { sanitizeMermaid } from '../../lib/mermaid-sanitize'

mermaid.initialize({
  startOnLoad: false,
  // Diagram source is model output, and the model sees retrieved context that
  // includes automatically ingested GitHub READMEs - so it is not trusted
  // input. 'strict' makes Mermaid run its own DOMPurify pass over the SVG it
  // returns and disables click handlers and inline script, which is what makes
  // injecting that SVG below safe. Set explicitly rather than relying on the
  // library default staying this way.
  securityLevel: 'strict',
  theme: 'base',
  themeVariables: {
    primaryColor: '#e0f2fe',
    primaryTextColor: '#0f172a',
    primaryBorderColor: '#0284c7',
    lineColor: '#0284c7',
    secondaryColor: '#f1f5f9',
    tertiaryColor: '#f8fafc',
    background: '#ffffff',
    mainBkg: '#e0f2fe',
    nodeBorder: '#0284c7',
    clusterBkg: '#f8fafc',
    titleColor: '#0f172a',
    edgeLabelBackground: '#ffffff',
    nodeTextColor: '#0f172a',
    textColor: '#0f172a',
    labelTextColor: '#475569',
    fontFamily: 'ui-monospace, monospace',
    fontSize: '13px',
  },
})

let mermaidCounter = 0

interface MermaidBlockProps {
  code: string
}

export function MermaidBlock({ code }: MermaidBlockProps) {
  const [svg, setSvg] = useState('')
  const [failed, setFailed] = useState(false)
  const idRef = useRef(`mermaid-${++mermaidCounter}`)

  useEffect(() => {
    let cancelled = false

    // `code` grows token by token while the answer streams, so early parses
    // legitimately fail on a half-written diagram. Clearing the flag on every
    // change lets a later, complete version succeed - previously the first
    // failure latched permanently and the diagram never recovered.
    setFailed(false)

    mermaid
      .render(idRef.current, sanitizeMermaid(code))
      .then(({ svg: rendered }) => {
        if (!cancelled) setSvg(rendered)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [code])

  // Only show source once a render has actually failed and we have nothing
  // better to show. Keeping the last good SVG avoids flashing raw source at
  // the reader on an intermediate streaming parse error.
  if (failed && !svg) {
    return (
      <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-bg-secondary p-3 text-xs text-text-secondary">
        <code>{code}</code>
      </pre>
    )
  }

  // Diagrams are routinely wider than a phone. Scroll them inside their own
  // container rather than letting them widen the message list; `mx-auto`
  // still centres anything that does fit. `justify-center` on a flex parent
  // would overflow to both sides and make the left half unreachable.
  return (
    <div
      className="my-3 max-w-full overflow-x-auto [&_svg]:mx-auto [&_svg]:h-auto"
      // Mermaid returns a self-contained SVG string; there is no React tree to
      // build from it, so this is the intended integration point.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
