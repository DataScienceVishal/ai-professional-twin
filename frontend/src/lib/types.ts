export type ChatMode = 'default' | 'recruiter' | 'interview'

export interface ToolActivity {
  tool: string
  args?: Record<string, unknown>
  summary?: string
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: SourceInfo[]
  toolsUsed?: ToolActivity[]
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

export interface SSEToolStartEvent {
  type: 'tool_start'
  tool: string
  args: Record<string, unknown>
}

export interface SSEToolResultEvent {
  type: 'tool_result'
  tool: string
  summary: string
}

export type SSEEvent =
  | SSEChunkEvent
  | SSESourcesEvent
  | SSEDoneEvent
  | SSEToolStartEvent
  | SSEToolResultEvent
