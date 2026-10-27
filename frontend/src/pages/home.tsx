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

export default function Home() {
  const { messages, isStreaming, mode, setMode, sendMessage, clearMessages, stopStreaming } = useChat()
  const { timeline } = useTimeline()
  const { projects, loading: projectsLoading } = useProjects()
  const { skills, loading: skillsLoading } = useSkills()
  const [focused, setFocused] = useState<SourceInfo | null>(null)
  const [titlePanelOut, setTitlePanelOut] = useState(false)
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

  // On desktop the contact bar steps aside while the title panel shows the same
  // links, and comes back once the panel has scrolled out of view.
  const watchTitlePanel = useCallback((panel: HTMLElement | null) => {
    if (!panel || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => setTitlePanelOut(!entries[entries.length - 1].isIntersecting))
    observer.observe(panel)
    return () => {
      observer.disconnect()
      setTitlePanelOut(false)
    }
  }, [])

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
          <ContactBar showOnDesktop={messages.length > 0 || titlePanelOut} />
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
                  titlePanelRef={watchTitlePanel}
                />
              }
              rail={record && <RecordStrip record={record} now={now} />}
            />
            <div className="shrink-0 space-y-2 border-t-[1.5px] border-ink bg-paper px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
              {/* At 320x256 (400% zoom) or on a phone held sideways the full dock
                  would leave the sheet a sliver, so only the question field stays. */}
              <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center lg:gap-3 [@media(max-height:30rem)]:hidden">
                <LayerSwitch mode={mode} onChange={setMode} />
                <LayerKey mode={mode} seed={messages.length + 1} onSelect={sendMessage} disabled={isStreaming} />
              </div>
              <InputBar onSend={sendMessage} onStop={stopStreaming} disabled={isStreaming} />
            </div>
          </main>
        </div>
      </SheetContext.Provider>
    </MotionConfig>
  )
}
