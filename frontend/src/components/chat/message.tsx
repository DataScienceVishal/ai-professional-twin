import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { motion } from 'framer-motion'
import { MermaidBlock } from './mermaid-block'
import { SourceCitation } from './source-citation'
import type { Message as MessageType } from '../../lib/types'

interface MessageProps {
  message: MessageType
}

export function Message({ message }: MessageProps) {
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
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                code({ className, children, ...props }) {
                  const match = /language-mermaid/.exec(className || '')
                  if (match) {
                    return <MermaidBlock code={String(children).trim()} />
                  }
                  return <code className={className} {...props}>{children}</code>
                },
                pre({ children }) {
                  return <>{children}</>
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 pt-2 border-t border-border/50 flex flex-wrap gap-1.5">
            {message.sources.map((source, i) => (
              <SourceCitation key={i} source={source} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
