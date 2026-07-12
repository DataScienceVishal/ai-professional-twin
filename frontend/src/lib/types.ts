export type ChatMode = 'default' | 'recruiter' | 'interview'

export interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: SourceInfo[]
}

export interface SourceInfo {
  source: string
  detail: string
  url: string
}

export interface Project {
  name: string
  slug: string
  description: string
  tech_stack: string[]
  github_url: string
  category: string
  highlights: string[]
}

export interface SkillCategory {
  category: string
  skills: string[]
  proficiency: string
}

export interface SSEChunkEvent {
  type: 'chunk'
  content: string
}

export interface SSESourcesEvent {
  type: 'sources'
  sources: SourceInfo[]
}

export interface SSEDoneEvent {
  type: 'done'
}

export type SSEEvent = SSEChunkEvent | SSESourcesEvent | SSEDoneEvent
