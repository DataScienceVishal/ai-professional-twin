import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ASK_FIELD_ID } from './input-bar'
import { Message } from './message'
import { SurveyNote } from '../sheet/survey-note'
import { sameSource, useSheet } from '../sheet/sheet-context'
import type { Message as MessageType } from '../../lib/types'

interface ChatPanelProps {
  messages: MessageType[]
  isStreaming: boolean
  /** What shows before the first question: the title panel, the recorded answer and the record. */
  firstSheet: ReactNode
  /** The record strip beside the conversation; absent when the timeline did not load. */
  rail?: ReactNode
  onClear: () => void
}

interface Turn {
  key: number
  question: string
  answer?: MessageType
}

function pairTurns(messages: MessageType[]): Turn[] {
  const turns: Turn[] = []
  messages.forEach((message, i) => {
    if (message.role !== 'user') return
    const next = messages[i + 1]
    turns.push({ key: i, question: message.content, answer: next?.role === 'assistant' ? next : undefined })
  })
  return turns
}

export function ChatPanel({ messages, isStreaming, firstSheet, rail, onClear }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const isAtBottom = useRef(true)
  const wasStreaming = useRef(false)
  const [announcement, setAnnouncement] = useState('')
  const { focused } = useSheet()
  const conversing = messages.length > 0
  const railShown = Boolean(rail)

  useEffect(() => {
    if (!scrollRef.current) return
    // The first sheet is taller than the viewport, so "follow the
    // conversation" must not fire when there is no conversation. That would
    // land the visitor at the bottom of the sources list on first paint, and
    // again after Clear chat.
    if (messages.length === 0) {
      isAtBottom.current = true
      scrollRef.current.scrollTop = 0
      return
    }
    if (isAtBottom.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // When the conversation opens, or the record arrives after it, the rail
  // rests on its latest entries, where the route ends at today. An open source
  // turns it to whatever that source lights. Only the frame scrolls:
  // scrollIntoView would move the sheet as well.
  useLayoutEffect(() => {
    const frame = railRef.current
    if (!frame) return
    const target = frame.querySelector<HTMLElement>('[data-lit]:not([data-graphic] *)')
    if (target) frame.scrollTop = target.offsetTop - 8
    else if (!focused) frame.scrollTop = frame.scrollHeight
  }, [focused, conversing, railShown])

  // The thinking line falls silent once text starts to arrive, so nothing would
  // tell a screen reader that the answer has finished. A failed turn has its own
  // alert, and a stopped one was stopped by the visitor, so neither is "ready".
  useEffect(() => {
    if (isStreaming || messages.length === 0) {
      setAnnouncement('')
    } else if (wasStreaming.current) {
      const last = messages[messages.length - 1]
      if (last.role === 'assistant' && last.content.trim() && !last.isError && !last.stopped) {
        setAnnouncement('Answer ready')
      }
    }
    wasStreaming.current = isStreaming
  }, [isStreaming, messages])

  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    isAtBottom.current = scrollHeight - scrollTop - clientHeight < 50
  }

  const turns = pairTurns(messages)

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      data-focus={focused ? 'on' : undefined}
      className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto [container-type:size]"
    >
      <p role="status" data-testid="answer-status" className="sr-only">
        {announcement}
      </p>
      {messages.length === 0 ? (
        firstSheet
      ) : (
        <div className="mx-auto grid w-full max-w-[1400px] gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_17.5rem] lg:gap-10 lg:p-8">
          {rail && (
            <aside aria-label="His record" data-record className="min-w-0 lg:hidden">
              <details className="border-[1.5px] border-ink">
                <summary className="sheet-label min-h-11 cursor-pointer px-3 py-3.5">His record</summary>
                <div className="px-3 pb-3">{rail}</div>
              </details>
            </aside>
          )}
          <div className="min-w-0 space-y-8">
            <div className="flex items-center justify-between gap-3">
              <h1 className="sheet-label">Conversation</h1>
              <button
                type="button"
                onClick={(event) => {
                  onClear()
                  // Clearing swaps this button for the first sheet, which would drop
                  // focus to <body>. A keyboard press (detail 0) hands focus to the
                  // ask field; a tap leaves it, so a phone keeps its keyboard down.
                  if (event.detail === 0) document.getElementById(ASK_FIELD_ID)?.focus()
                }}
                className="min-h-11 px-2 text-sm text-muted underline underline-offset-2 hover:text-ink lg:min-h-6"
              >
                Clear chat
              </button>
            </div>
            {turns.map((turn, n) => {
              const last = n === turns.length - 1
              const lit = Boolean(turn.answer?.sources?.some((source) => sameSource(focused, source)))
              return (
                <SurveyNote
                  key={turn.key}
                  question={turn.question}
                  writing={isStreaming && last}
                  busy={isStreaming && last && Boolean(turn.answer?.content)}
                  lit={lit}
                >
                  {turn.answer && <Message message={turn.answer} isStreaming={isStreaming && last} />}
                </SurveyNote>
              )
            })}
          </div>
          {rail && (
            <aside data-record className="hidden min-w-0 lg:block">
              {/* The strip can be taller than the scroller, so this frame scrolls on its own.
                  Safari never focuses a scroll box by itself, so `tabIndex` lets the keyboard in. */}
              <div
                ref={railRef}
                tabIndex={0}
                role="group"
                aria-label="His record"
                data-scroll-fade="y"
                className="scroll-frame sticky top-8 max-h-[calc(100cqh_-_4rem)] overflow-y-auto"
              >
                {rail}
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  )
}
