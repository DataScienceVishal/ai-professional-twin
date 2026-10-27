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
    primaryColor: '#e4edf7',
    primaryTextColor: '#1b1b1b',
    primaryBorderColor: '#2b6cb0',
    lineColor: '#2b6cb0',
    secondaryColor: '#e3f0db',
    tertiaryColor: '#ffffff',
    background: '#ffffff',
    mainBkg: '#e4edf7',
    nodeBorder: '#2b6cb0',
    clusterBkg: '#ffffff',
    clusterBorder: '#2b6cb0',
    titleColor: '#1b1b1b',
    edgeLabelBackground: '#ffffff',
    nodeTextColor: '#1b1b1b',
    textColor: '#1b1b1b',
    labelTextColor: '#5b6470',
    noteBkgColor: '#e4edf7',
    noteBorderColor: '#2b6cb0',
    noteTextColor: '#1b1b1b',
    activationBorderColor: '#2b6cb0',
    fontFamily: 'Signika, system-ui, sans-serif',
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
      <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words border border-ink/20 p-3 text-xs text-muted">
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
