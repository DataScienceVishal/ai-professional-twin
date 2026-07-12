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
    'What was his role at Teleperformance?',
    'What programming languages does he know?',
    'Does he have experience with cloud platforms?',
    'Tell me about his research publications',
    'What databases has he worked with?',
    'What is his MSc thesis about?',
    'How long has he been in the industry?',
    'What machine learning models has he built?',
    'Does he have experience with data pipelines?',
    'What certifications does he hold?',
    'Where is he currently based?',
    'What are his key achievements?',
    'Has he worked with deep learning?',
    'What tools does he use for data visualization?',
    'Tell me about his CNN project',
    'What is his experience with Python?',
    'Does he have experience with SQL?',
    'What is reinforcement learning pricing optimization?',
    'Has he published any research papers?',
    'What did he study at Liverpool John Moores?',
    'What is his experience with Databricks?',
  ],
  recruiter: [
    'Summarize Vishal as a candidate in 60 seconds',
    'Why should we hire Vishal?',
    'Show his AI and LLM project experience',
    'What is his data engineering background?',
    'What makes him stand out from other candidates?',
    'Is he available for roles in London?',
    'What is his salary expectation range?',
    'Does he have experience leading projects?',
    'What is his notice period?',
    'How does he handle tight deadlines?',
    'What kind of teams has he worked with?',
    'Does he have experience in agile environments?',
    'What industries has he worked in?',
    'Can he work with cross-functional teams?',
    'What is his communication style?',
    'Does he have mentoring experience?',
    'What are his career goals for the next 2 years?',
    'How does he stay updated with AI trends?',
    'What value can he bring to our team?',
    'Does he have production deployment experience?',
    'What is his strongest technical skill?',
    'Has he worked with real-time data systems?',
    'What is his approach to problem solving?',
    'Does he have experience with CI/CD pipelines?',
    'How has he demonstrated impact in previous roles?',
  ],
  interview: [
    'Explain the RAG architecture in this project',
    'How does the retrieval pipeline work?',
    'Walk through the FastAPI backend design',
    'What engineering tradeoffs did you make?',
    'Explain the prompt engineering approach',
    'How do embeddings work in this system?',
    'What chunking strategy did you use and why?',
    'How does hybrid search work here?',
    'How do you handle streaming responses?',
    'Explain your reinforcement learning research',
    'What is your approach to data pipeline design?',
    'How would you scale this application?',
    'Explain the CNN architecture you used for CIFAR-10',
    'What regularization techniques have you applied?',
    'How do you evaluate model performance?',
    'Describe a challenging bug you have debugged',
    'How do you handle data quality issues?',
    'What is your testing strategy for ML systems?',
    'How would you implement caching for this RAG system?',
    'Explain vector similarity search',
    'What are the limitations of this AI twin approach?',
    'How do you handle prompt injection?',
    'What would you change about this architecture?',
    'How do you monitor ML models in production?',
    'Explain cosine similarity vs dot product for embeddings',
  ],
}

export function getShuffledChips(mode: ChatMode, seed: number, count = 5): string[] {
  const all = [...SUGGESTION_CHIPS[mode]]
  let s = seed
  for (let i = all.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const j = s % (i + 1)
    ;[all[i], all[j]] = [all[j], all[i]]
  }
  return all.slice(0, count)
}

export const PROFILE = {
  name: 'Vishal Khan',
  title: 'AI Engineer & MSc AI Student',
  avatarUrl: 'https://github.com/DataScienceVishal.png',
  githubUrl: 'https://github.com/DataScienceVishal',
  linkedinUrl: 'https://www.linkedin.com/in/vishal-khan-a53aboraaa',
}
