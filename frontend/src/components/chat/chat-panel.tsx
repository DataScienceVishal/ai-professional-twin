import { useEffect, useRef } from 'react'
import { Message } from './message'
import { InputBar } from './input-bar'
import { SuggestionChips } from './suggestion-chips'
import type { Message as MessageType, ChatMode } from '../../lib/types'

interface ChatPanelProps {
  messages: MessageType[]
  isStreaming: boolean
  mode: ChatMode
  onSend: (message: string) => void
}

export function ChatPanel({ messages, isStreaming, mode, onSend }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const isAtBottom = useRef(true)

  useEffect(() => {
    if (isAtBottom.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    isAtBottom.current = scrollHeight - scrollTop - clientHeight < 50
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-accent-cyan/10 border border-accent-cyan/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-accent-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
              Vishal Khan's AI Twin
            </h1>
            <p className="text-sm text-text-secondary max-w-sm leading-relaxed">
              Ask me anything about Vishal's experience, projects, skills, and career.
              Grounded in real data with source citations.
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <Message
            key={i}
            message={msg}
            isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
          />
        ))}
        {isStreaming && (
          <div className="flex gap-1 px-4 py-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-bounce [animation-delay:0.1s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-bounce [animation-delay:0.2s]" />
          </div>
        )}
      </div>
      <SuggestionChips
        mode={mode}
        onSelect={onSend}
        messageCount={messages.length}
      />
      <InputBar onSend={onSend} disabled={isStreaming} />
    </div>
  )
}
