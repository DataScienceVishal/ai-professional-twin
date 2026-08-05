import { isValidElement, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { motion } from 'framer-motion'
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

function ToolBadge({ activity }: { activity: ToolActivity }) {
  const label = TOOL_LABELS[activity.tool] || activity.tool
  const isLoading = !activity.summary

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${
        isLoading
          ? 'bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan motion-safe:animate-pulse'
          : 'bg-accent-cyan/10 border border-accent-cyan/15 text-accent-cyan'
      }`}
    >
      <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      {isLoading ? `${label}...` : label}
    </span>
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
      className="my-3 flex h-32 max-w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-bg-card/40 text-xs text-text-secondary"
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
  const isUser = message.role === 'user'
  // The turn is in flight and nothing has streamed yet: show the pending state
  // instead of an empty bubble. The first `chunk` event removes it.
  const isPending = !isUser && isStreaming && message.content.length === 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        role={message.isError ? 'alert' : undefined}
        className={`min-w-0 max-w-[92%] break-words rounded-xl px-4 py-3 sm:max-w-[85%] lg:max-w-[80%] ${
          isUser
            ? 'bg-accent-cyan/10 border border-accent-cyan/20 text-text-primary'
            : message.isError
              ? 'bg-red-50 border border-red-200 text-red-900'
              : 'bg-bg-card border border-border text-text-primary'
        }`}
      >
        {isUser ? (
          <p className="text-sm">{message.content}</p>
        ) : isPending ? (
          <ThinkingIndicator toolsUsed={message.toolsUsed} />
        ) : (
          <div className="prose prose-sm max-w-none">
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
          <div className="mt-2 pt-2 border-t border-border/50 flex flex-wrap gap-1.5">
            {message.toolsUsed.map((activity, i) => (
              <ToolBadge key={i} activity={activity} />
            ))}
          </div>
        )}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/50 flex flex-wrap gap-1.5">
            {message.sources.map((source, i) => (
              <SourceCitation key={i} source={source} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
