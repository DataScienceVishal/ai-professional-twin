import { isValidElement, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { motion, useReducedMotionConfig } from 'framer-motion'
import { MermaidBlock } from './mermaid-block'
import { fenceBareMermaid } from '../../lib/mermaid-sanitize'
import { SourceCitation } from './source-citation'
import { ThinkingIndicator } from './thinking-indicator'
import type { Message as MessageType, ToolActivity } from '../../lib/types'

interface MessageProps {
  message: MessageType
  isStreaming?: boolean
}

const TOOL_LABELS: Record<string, string> = {
  search_repos: 'Searched GitHub',
  get_repo_stats: 'Fetched Repo Stats',
  get_recent_activity: 'Checked Activity',
  calculate_experience: 'Calculated Experience',
  count_projects_by_category: 'Counted Projects',
  get_skill_summary: 'Fetched Skills',
  get_resume_download_link: 'Resume Link',
  generate_comparison_table: 'Generated Table',
}

function ToolLine({ activity, streaming }: { activity: ToolActivity; streaming: boolean }) {
  const label = TOOL_LABELS[activity.tool] || activity.tool
  const running = streaming && !activity.summary

  return (
    <li className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 shrink-0 ${running ? 'bg-route motion-safe:animate-pulse' : 'bg-muted'}`}
      />
      {running ? `${label}...` : label}
    </li>
  )
}

function extractMermaid(children: ReactNode): string | null {
  const childArray = Array.isArray(children) ? children : [children]
  for (const child of childArray) {
    if (!isValidElement(child)) continue
    const props = child.props as { className?: string; children?: ReactNode }
    const className = props.className || ''
    if (/language-mermaid/.test(className) || /hljs.*mermaid/.test(className)) {
      const text = extractText(props.children)
      return text.trim() || null
    }
  }
  return null
}

function extractText(node: ReactNode): string {
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode }
    return extractText(props.children)
  }
  return ''
}

/**
 * Code blocks are the widest thing a message can contain. Without an explicit
 * scroll container the `<code>` child renders at its full unwrapped width and
 * drags the whole message list sideways on a phone.
 */
function CodeBlock({ children }: { children: ReactNode }) {
  return <pre className="max-w-full overflow-x-auto">{children}</pre>
}

/**
 * Stands in for a diagram while its source is still streaming. Sized to roughly
 * a small flowchart so the surrounding text does not jump when the real SVG
 * replaces it.
 */
function DiagramPending() {
  return (
    <div
      role="status"
      aria-label="Building diagram"
      className="my-3 flex h-32 max-w-full items-center justify-center gap-2 border border-dashed border-ink/30 text-xs text-muted"
    >
      <svg className="h-3.5 w-3.5 motion-safe:animate-pulse" viewBox="0 0 16 16" fill="currentColor">
        <rect x="1" y="1" width="6" height="4" rx="1" />
        <rect x="9" y="6" width="6" height="4" rx="1" />
        <rect x="1" y="11" width="6" height="4" rx="1" />
      </svg>
      Building diagram…
    </div>
  )
}

export function Message({ message, isStreaming = false }: MessageProps) {
  // The page's reducedMotion setting stops the rise but still runs the fade,
  // and under reduced motion nothing may animate, so the answer starts in place.
  const reduceMotion = useReducedMotionConfig()
  const isUser = message.role === 'user'
  // The turn is in flight and nothing has streamed yet: show the pending state
  // instead of an empty note. The first `chunk` event removes it.
  const isPending = !isUser && isStreaming && message.content.length === 0

  if (isUser) return <p className="text-base">{message.content}</p>

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      data-testid="answer"
      role={message.isError ? 'alert' : undefined}
      className={`min-w-0 break-words text-base lg:text-[15px] leading-relaxed ${
        message.isError ? 'border border-dashed border-ink p-3' : ''
      }`}
    >
      {message.isError && <p className="sheet-label mb-1">Could not answer</p>}
      {isPending ? (
        <ThinkingIndicator toolsUsed={message.toolsUsed} />
      ) : (
        <div className="prose max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={{
              pre({ children }) {
                const mermaidCode = extractMermaid(children)
                // A half-written diagram cannot parse, so it is not rendered
                // until the stream finishes. Showing its raw source in the
                // meantime reads as broken output rather than as progress,
                // so hold a placeholder instead and swap in the diagram.
                if (isStreaming) {
                  return mermaidCode ? <DiagramPending /> : <CodeBlock>{children}</CodeBlock>
                }
                if (mermaidCode) return <MermaidBlock code={mermaidCode} />
                return <CodeBlock>{children}</CodeBlock>
              },
              // Comparison tables are wide; scroll them instead of the page.
              table({ children }) {
                return (
                  <div className="max-w-full overflow-x-auto">
                    <table>{children}</table>
                  </div>
                )
              },
            }}
          >
            {fenceBareMermaid(message.content)}
          </ReactMarkdown>
        </div>
      )}
      {message.toolsUsed && message.toolsUsed.length > 0 && (
        <ul aria-label="Tools used" className="mt-3 space-y-1 text-xs text-muted">
          {message.toolsUsed.map((activity, i) => (
            <ToolLine key={i} activity={activity} streaming={isStreaming} />
          ))}
        </ul>
      )}
      {message.sources && message.sources.length > 0 && (
        <div className="mt-3 border-t border-ink/15 pt-2">
          <p className="sheet-label">Sources</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {message.sources.map((source, i) => (
              <SourceCitation key={i} source={source} />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}
