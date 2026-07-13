import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: false,
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
          containerRef.current.innerHTML = svg
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
