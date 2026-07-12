import { useEffect, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    primaryColor: '#1e293b',
    primaryTextColor: '#e2e8f0',
    primaryBorderColor: '#38bdf8',
    lineColor: '#38bdf8',
    secondaryColor: '#161b24',
    tertiaryColor: '#0c0f14',
    fontFamily: 'ui-monospace, monospace',
    fontSize: '13px',
  },
})

let mermaidCounter = 0

interface MermaidBlockProps {
  code: string
}

export function MermaidBlock({ code }: MermaidBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)
  const idRef = useRef(`mermaid-${++mermaidCounter}`)

  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false

    mermaid
      .render(idRef.current, code)
      .then(({ svg }) => {
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } })
        }
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })

    return () => {
      cancelled = true
    }
  }, [code])

  if (error) {
    return (
      <pre className="rounded-lg bg-bg-primary border border-border p-3 text-xs text-text-secondary overflow-x-auto">
        <code>{code}</code>
      </pre>
    )
  }

  return (
    <div
      ref={containerRef}
      className="my-3 flex justify-center [&_svg]:max-w-full"
    />
  )
}
