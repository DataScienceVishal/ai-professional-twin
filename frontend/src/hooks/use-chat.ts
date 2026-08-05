import { useCallback, useEffect, useRef, useState } from 'react'
import { streamChat } from '../lib/api'
import type { ChatMode, Message, SourceInfo, ToolActivity } from '../lib/types'

const GENERIC_ERROR =
  'Sorry, I could not reach the assistant backend. Please try again in a moment.'

function describeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'AbortError') return 'Request cancelled.'
    return error.message ? `${GENERIC_ERROR} (${error.message})` : GENERIC_ERROR
  }
  return GENERIC_ERROR
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [mode, setMode] = useState<ChatMode>('default')
  const abortRef = useRef<AbortController | null>(null)

  /** Abort any in-flight request. Safe to call when nothing is running. */
  const abortInFlight = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  /** Public control so the UI can stop a response mid-stream. */
  const stopStreaming = useCallback(() => {
    abortInFlight()
    setIsStreaming(false)
  }, [abortInFlight])

  // Cancel the in-flight request if the component unmounts.
  useEffect(() => () => abortInFlight(), [abortInFlight])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return

      // A new turn supersedes anything still running.
      abortInFlight()
      const controller = new AbortController()
      abortRef.current = controller

      const userMessage: Message = { role: 'user', content }
      const updatedMessages = [...messages, userMessage]
      setMessages(updatedMessages)
      setIsStreaming(true)

      const assistantMessage: Message = {
        role: 'assistant',
        content: '',
        sources: [],
        toolsUsed: [],
      }
      setMessages([...updatedMessages, assistantMessage])

      const patchLast = (patch: Partial<Message>) => {
        setMessages((prev) => {
          if (prev.length === 0) return prev
          const next = [...prev]
          next[next.length - 1] = { ...next[next.length - 1], ...patch }
          return next
        })
      }

      try {
        const chatMessages = updatedMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }))

        let fullContent = ''
        let sources: SourceInfo[] = []
        let streamError: string | null = null
        const toolsUsed: ToolActivity[] = []

        for await (const event of streamChat(chatMessages, mode, controller.signal)) {
          if (event.type === 'chunk') {
            fullContent += event.content
            patchLast({ content: fullContent })
          } else if (event.type === 'tool_start') {
            toolsUsed.push({ tool: event.tool, args: event.args })
            patchLast({ toolsUsed: [...toolsUsed] })
          } else if (event.type === 'tool_result') {
            const last = toolsUsed[toolsUsed.length - 1]
            if (last && last.tool === event.tool) {
              last.summary = event.summary
            }
            patchLast({ toolsUsed: [...toolsUsed] })
          } else if (event.type === 'sources') {
            sources = event.sources
          } else if (event.type === 'error') {
            streamError = event.message || GENERIC_ERROR
            console.error('[chat] backend reported an error:', event.message)
            patchLast({
              content: fullContent ? `${fullContent}\n\n${streamError}` : streamError,
              isError: true,
            })
          } else if (event.type === 'done') {
            patchLast({
              content: streamError
                ? fullContent
                  ? `${fullContent}\n\n${streamError}`
                  : streamError
                : fullContent,
              sources,
              toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
              isError: streamError !== null,
            })
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          // Superseded or unmounted - leave the partial message as-is.
          return
        }
        console.error('[chat] streaming failed:', error)
        patchLast({ content: describeError(error), isError: true })
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null
          setIsStreaming(false)
        }
      }
    },
    [messages, mode, isStreaming, abortInFlight],
  )

  const clearMessages = useCallback(() => {
    abortInFlight()
    setIsStreaming(false)
    setMessages([])
  }, [abortInFlight])

  return {
    messages,
    isStreaming,
    mode,
    setMode,
    sendMessage,
    clearMessages,
    stopStreaming,
  }
}
