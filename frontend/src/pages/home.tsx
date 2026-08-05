import { useChat } from '../hooks/use-chat'
import { Sidebar } from '../components/layout/sidebar'
import { Header } from '../components/layout/header'
import { ChatPanel } from '../components/chat/chat-panel'
import { RecruiterPanel } from '../components/modes/recruiter-panel'
import { InterviewPanel } from '../components/modes/interview-panel'

export default function Home() {
  const { messages, isStreaming, mode, setMode, sendMessage, clearMessages, stopStreaming } =
    useChat()

  return (
    // `h-dvh` tracks the shrinking/growing mobile browser chrome so the input
    // bar stays on screen; `overflow-hidden` keeps the shell itself from ever
    // scrolling - the message list is the only scroller.
    <div className="flex h-dvh overflow-hidden bg-bg-primary text-text-primary">
      <Sidebar mode={mode} onModeChange={setMode} onClear={clearMessages} />

      <div className="flex flex-col flex-1 min-w-0">
        <Header mode={mode} onModeChange={setMode} />
        <ChatPanel
          messages={messages}
          isStreaming={isStreaming}
          mode={mode}
          onSend={sendMessage}
          onStop={stopStreaming}
        />
      </div>

      {mode === 'recruiter' && <RecruiterPanel onAction={sendMessage} />}
      {mode === 'interview' && <InterviewPanel onAction={sendMessage} />}
    </div>
  )
}
