import { useChat } from '../hooks/use-chat'
import { Sidebar } from '../components/layout/sidebar'
import { Header } from '../components/layout/header'
import { ChatPanel } from '../components/chat/chat-panel'
import { RecruiterPanel } from '../components/modes/recruiter-panel'
import { InterviewPanel } from '../components/modes/interview-panel'

export default function Home() {
  const { messages, isStreaming, mode, setMode, sendMessage, clearMessages } = useChat()

  return (
    <div className="flex h-dvh bg-bg-primary text-text-primary">
      <Sidebar mode={mode} onModeChange={setMode} onClear={clearMessages} />

      <div className="flex flex-col flex-1 min-w-0">
        <Header mode={mode} onModeChange={setMode} />
        <ChatPanel
          messages={messages}
          isStreaming={isStreaming}
          mode={mode}
          onSend={sendMessage}
        />
      </div>

      {mode === 'recruiter' && <RecruiterPanel onAction={sendMessage} />}
      {mode === 'interview' && <InterviewPanel onAction={sendMessage} />}
    </div>
  )
}
