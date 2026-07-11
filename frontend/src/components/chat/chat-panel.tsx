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
          <div className="flex flex-col items-center justify-center h-full text-center gap-4">
            <h1 className="text-3xl font-bold text-text-primary">
              Vishal Khan's AI Twin
            </h1>
            <p className="text-text-secondary max-w-md">
              Ask me anything about Vishal's experience, projects, skills, and career.
              I'm grounded in real data and will cite my sources.
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <Message key={i} message={msg} />
        ))}
        {isStreaming && (
          <div className="flex gap-1 px-4 py-2">
            <span className="w-2 h-2 rounded-full bg-accent-cyan animate-bounce" />
            <span className="w-2 h-2 rounded-full bg-accent-cyan animate-bounce [animation-delay:0.1s]" />
            <span className="w-2 h-2 rounded-full bg-accent-cyan animate-bounce [animation-delay:0.2s]" />
          </div>
        )}
      </div>
      <SuggestionChips
        mode={mode}
        onSelect={onSend}
        visible={messages.length === 0}
      />
      <InputBar onSend={onSend} disabled={isStreaming} />
    </div>
  )
}
