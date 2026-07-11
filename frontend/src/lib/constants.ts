import type { ChatMode } from './types'

export const MODE_LABELS: Record<ChatMode, string> = {
  default: 'General',
  recruiter: 'Recruiter',
  interview: 'Interview',
}

export const SUGGESTION_CHIPS: Record<ChatMode, string[]> = {
  default: [
    'Tell me about Vishal',
    'What projects has he built?',
    'What are his technical skills?',
    'What is his educational background?',
    'What was his role at Accenture?',
  ],
  recruiter: [
    'Summarize Vishal in 60 seconds',
    'Why should we hire Vishal?',
    'Show AI and LLM projects',
    'Show Data Engineering experience',
    'What makes him stand out?',
  ],
  interview: [
    'Explain the RAG architecture in this project',
    'How does the retrieval pipeline work?',
    'Walk through the FastAPI backend design',
    'What engineering tradeoffs did you make?',
    'Explain the prompt engineering approach',
  ],
}

export const PROFILE = {
  name: 'Vishal Khan',
  title: 'AI Engineer & MSc AI Student',
  avatarUrl: 'https://github.com/DataScienceVishal.png',
  githubUrl: 'https://github.com/DataScienceVishal',
  linkedinUrl: 'https://www.linkedin.com/in/vishal-khan-a53aboraaa',
}
