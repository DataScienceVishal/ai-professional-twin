import type { ChatMode, Project, SkillCategory, SSEEvent } from './types'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

export async function* streamChat(
  messages: { role: string; content: string }[],
  mode: ChatMode,
): AsyncGenerator<SSEEvent> {
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, mode }),
  })

  if (!response.ok) {
    throw new Error(`Chat request failed: ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim()
        if (data) {
          try {
            yield JSON.parse(data) as SSEEvent
          } catch {
            // skip malformed events
          }
        }
      }
    }
  }
}

export async function fetchProjects(): Promise<Project[]> {
  const response = await fetch(`${API_BASE}/projects`)
  if (!response.ok) return []
  return response.json()
}

export async function fetchSkills(): Promise<SkillCategory[]> {
  const response = await fetch(`${API_BASE}/skills`)
  if (!response.ok) return []
  return response.json()
}

export function getResumeDownloadUrl(): string {
  return `${API_BASE}/resume/download`
}
