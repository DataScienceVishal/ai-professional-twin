import { isValidElement, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { motion, useReducedMotionConfig } from 'framer-motion'
import { DiagramPending, MermaidBlock } from './mermaid-block'
import { CONTACT_MAILTO } from '../../lib/constants'
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
  return <pre className="scroll-frame max-w-full overflow-x-auto">{children}</pre>
}

/**
 * Renderers for the parts of an answer that plain markdown does not cover.
 * react-markdown uses each function as a component type, so a new function on
 * every render would remount every code block, table and diagram. A finished
 * answer re-renders on each chunk of the next one, so both sets are built once.
 */
function markdownComponents(isStreaming: boolean): Components {
  return {
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
        <div className="scroll-frame max-w-full overflow-x-auto">
          <table>{children}</table>
        </div>
      )
    },
  }
}

const STREAMING_COMPONENTS = markdownComponents(true)
const SETTLED_COMPONENTS = markdownComponents(false)

export function Message({ message, isStreaming = false }: MessageProps) {
  // The page's reducedMotion setting stops the rise but still runs the fade,
  // and under reduced motion nothing may animate, so the answer starts in place.
  const reduceMotion = useReducedMotionConfig()
  if (message.role === 'user') return <p className="text-base">{message.content}</p>

  // The turn is in flight and nothing has streamed yet: show the pending state
  // instead of an empty note. The first `chunk` event removes it.
  const isPending = isStreaming && message.content.length === 0
  // A settled turn with no text would read as a broken note, so it says what
  // happened. Whitespace alone renders nothing, so it counts as no text.
  const closingLine =
    isStreaming || message.isError || message.content.trim()
      ? null
      : message.stopped
        ? 'Stopped before an answer arrived.'
        : 'No answer arrived.'

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
      {closingLine ? (
        <p className="text-sm text-muted">{closingLine}</p>
      ) : isPending ? (
        <ThinkingIndicator toolsUsed={message.toolsUsed} />
      ) : (
        <div className="prose max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={isStreaming ? STREAMING_COMPONENTS : SETTLED_COMPONENTS}
          >
            {fenceBareMermaid(message.content)}
          </ReactMarkdown>
        </div>
      )}
      {message.limited && (
        <p className="mt-2">
          You can still reach him directly:{' '}
          <a href={CONTACT_MAILTO} className="py-1 font-semibold text-survey underline underline-offset-2">
            Email
          </a>
        </p>
      )}
      {message.toolsUsed && message.toolsUsed.length > 0 && (
        <ul role="list" aria-label="Tools used" className="mt-3 space-y-1 text-xs text-muted">
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
