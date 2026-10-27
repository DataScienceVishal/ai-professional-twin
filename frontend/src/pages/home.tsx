import { useCallback, useEffect, useMemo, useState } from 'react'
import { MotionConfig } from 'framer-motion'
import { useChat } from '../hooks/use-chat'
import { useProjects } from '../hooks/use-projects'
import { useSkills } from '../hooks/use-skills'
import { useTimeline } from '../hooks/use-timeline'
import { ChatPanel } from '../components/chat/chat-panel'
import { InputBar } from '../components/chat/input-bar'
import { ContactBar } from '../components/sheet/contact-bar'
import { FirstSheet } from '../components/sheet/first-sheet'
import { LayerKey } from '../components/sheet/layer-key'
import { LayerSwitch } from '../components/sheet/layer-switch'
import { RecordStrip } from '../components/sheet/route-map'
import { SheetContext, type TrailingTokens } from '../components/sheet/sheet-context'
import { FULL_TIME_FROM } from '../lib/constants'
import { buildRecord } from '../lib/timeline'
import type { SourceInfo } from '../lib/types'

const LAYER_ROW_ID = 'layer-row'

export default function Home() {
  const { messages, isStreaming, mode, setMode, sendMessage, clearMessages, stopStreaming } = useChat()
  const { timeline } = useTimeline()
  const { projects, loading: projectsLoading } = useProjects()
  const { skills, loading: skillsLoading } = useSkills()
  const [focused, setFocused] = useState<SourceInfo | null>(null)
  const [contactRowOut, setContactRowOut] = useState(false)
  const [layersOpen, setLayersOpen] = useState(false)
  const now = useMemo(() => new Date(), [])

  const record = useMemo(() => (timeline ? buildRecord(timeline, now, FULL_TIME_FROM) : null), [timeline, now])
  const trailing = useMemo<TrailingTokens>(
    () => ({
      projects: projects.map((p) => p.category),
      academics: timeline?.education.map((e) => e.degree) ?? [],
    }),
    [projects, timeline],
  )

  useEffect(() => {
    if (!focused) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFocused(null)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [focused])

  // On desktop the contact bar steps aside while the title panel's own contact
  // links are wholly in view, and comes back the moment any part of that row
  // leaves, so a contact link is always on screen.
  const watchContactRow = useCallback((row: HTMLDivElement | null) => {
    if (!row || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => setContactRowOut(entries[entries.length - 1].intersectionRatio < 1),
      { threshold: 1 },
    )
    observer.observe(row)
    return () => {
      observer.disconnect()
      setContactRowOut(false)
    }
  }, [])

  const hasRecord = Boolean(record && (record.entries.length > 0 || record.unplotted.length > 0))

  // Once a question is on its way the answer needs the room the open row takes.
  const send = (message: string) => {
    setLayersOpen(false)
    sendMessage(message)
  }

  const clear = () => {
    setFocused(null)
    clearMessages()
  }

  return (
    <MotionConfig reducedMotion="user">
      <SheetContext.Provider value={{ record, trailing, focused, setFocused }}>
        {/* `h-dvh` tracks the shrinking and growing mobile browser chrome so the
            ask bar stays on screen; the shell itself never scrolls. */}
        <div className="flex h-dvh flex-col overflow-hidden bg-paper text-ink">
          <ContactBar showOnDesktop={messages.length > 0 || contactRowOut} overlay={messages.length === 0} />
          <main data-layer={mode} className="flex min-h-0 flex-1 flex-col md:m-3 md:neatline">
            <ChatPanel
              messages={messages}
              isStreaming={isStreaming}
              onClear={clear}
              firstSheet={
                <FirstSheet
                  record={record}
                  now={now}
                  projects={projects}
                  projectsLoading={projectsLoading}
                  skills={skills}
                  skillsLoading={skillsLoading}
                  contactRowRef={watchContactRow}
                />
              }
              rail={record && hasRecord ? <RecordStrip record={record} now={now} /> : undefined}
            />
            {/* On short screens (a phone held sideways, or 200% zoom and beyond) the
                full dock would leave the sheet a sliver, so the layer row folds behind
                a toggle beside the field. The toggle comes first in the DOM, so Tab
                moves from it into the row it opens above. */}
            <div className="grid shrink-0 grid-cols-[minmax(0,1fr)] gap-x-2 border-t-[1.5px] border-ink bg-paper px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 [@media(max-height:30rem)]:grid-cols-[auto_minmax(0,1fr)]">
              <button
                type="button"
                // The name stays whole at every width; below sm the label shortens to its first word.
                aria-label="Layers and questions"
                aria-expanded={layersOpen}
                aria-controls={LAYER_ROW_ID}
                onClick={() => setLayersOpen((open) => !open)}
                className="group col-start-1 row-start-2 hidden min-h-11 items-center gap-1.5 border-[1.5px] border-ink px-3 text-xs font-semibold uppercase tracking-[0.12em] [@media(max-height:30rem)]:flex"
              >
                <span>
                  Layers<span className="max-sm:hidden"> and questions</span>
                </span>
                <svg
                  className="h-3 w-3 shrink-0 group-aria-expanded:rotate-180"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <path d="M3.5 10.5 8 6l4.5 4.5" />
                </svg>
              </button>
              <div
                id={LAYER_ROW_ID}
                className={`col-span-full row-start-1 mb-2 flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center lg:gap-3 sm:[@media(max-height:30rem)]:flex-row sm:[@media(max-height:30rem)]:items-center ${
                  layersOpen ? '' : '[@media(max-height:30rem)]:hidden'
                }`}
              >
                <LayerSwitch mode={mode} onChange={setMode} />
                <LayerKey mode={mode} seed={messages.length + 1} onSelect={send} disabled={isStreaming} />
              </div>
              <div className="row-start-2 min-w-0 [@media(max-height:30rem)]:col-start-2">
                <InputBar onSend={send} onStop={stopStreaming} disabled={isStreaming} />
              </div>
            </div>
          </main>
        </div>
      </SheetContext.Provider>
    </MotionConfig>
  )
}
