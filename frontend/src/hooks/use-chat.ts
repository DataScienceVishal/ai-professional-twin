import { useCallback, useRef, useState } from 'react'
import { streamChat } from '../lib/api'
import type { ChatMode, Message, SourceInfo } from '../lib/types'

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [mode, setMode] = useState<ChatMode>('default')
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return

      const userMessage: Message = { role: 'user', content }
      const updatedMessages = [...messages, userMessage]
      setMessages(updatedMessages)
      setIsStreaming(true)

      const assistantMessage: Message = { role: 'assistant', content: '', sources: [] }
      setMessages([...updatedMessages, assistantMessage])

      try {
        const chatMessages = updatedMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }))

        let fullContent = ''
        let sources: SourceInfo[] = []

        for await (const event of streamChat(chatMessages, mode)) {
          if (event.type === 'chunk') {
            fullContent += event.content
            setMessages((prev) => {
              const next = [...prev]
              next[next.length - 1] = {
                ...next[next.length - 1],
                content: fullContent,
              }
              return next
            })
          } else if (event.type === 'sources') {
            sources = event.sources
          } else if (event.type === 'done') {
            setMessages((prev) => {
              const next = [...prev]
              next[next.length - 1] = {
                ...next[next.length - 1],
                content: fullContent,
                sources,
              }
              return next
            })
          }
        }
      } catch (error) {
        setMessages((prev) => {
          const next = [...prev]
          next[next.length - 1] = {
            ...next[next.length - 1],
            content: 'Sorry, something went wrong. Please try again.',
          }
          return next
        })
      } finally {
        setIsStreaming(false)
      }
    },
    [messages, mode, isStreaming],
  )

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  return { messages, isStreaming, mode, setMode, sendMessage, clearMessages }
}
