import { isValidElement, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { motion } from 'framer-motion'
import { MermaidBlock } from './mermaid-block'
import { SourceCitation } from './source-citation'
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
          ? 'bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan animate-pulse'
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

export function Message({ message, isStreaming = false }: MessageProps) {
  const isUser = message.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[80%] rounded-xl px-4 py-3 ${
          isUser
            ? 'bg-accent-cyan/10 border border-accent-cyan/20 text-text-primary'
            : 'bg-bg-card border border-border text-text-primary'
        }`}
      >
        {isUser ? (
          <p className="text-sm">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                pre({ children }) {
                  if (isStreaming) return <pre>{children}</pre>
                  const mermaidCode = extractMermaid(children)
                  if (mermaidCode) return <MermaidBlock code={mermaidCode} />
                  return <pre>{children}</pre>
                },
              }}
            >
              {message.content}
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
