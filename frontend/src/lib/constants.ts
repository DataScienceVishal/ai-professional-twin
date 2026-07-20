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
    'What databases has he worked with?',
    'What is his MSc thesis about?',
    'How long has he been in the industry?',
    'What machine learning models has he built?',
    'Does he have experience with data pipelines?',
    'What certifications does he hold?',
    'Where is he currently based?',
    'What are his key achievements?',
    'Has he worked with deep learning?',
    'Tell me about his CNN project',
    'What is his experience with Python?',
    'Does he have experience with SQL?',
    'What did he study at Liverpool John Moores?',
    'What is his experience with Databricks?',
    'What Generative AI tools does he know?',
    'What is his experience with RAG systems?',
    'Does he know PyTorch or TensorFlow?',
    'What did he study at IIIT Bangalore?',
    'What is he currently studying at Northeastern?',
    'What was his role at Avant Garde?',
    'What kind of role is he looking for?',
    'Tell me about his reinforcement learning thesis',
  ],
  recruiter: [
    'Summarize Vishal as a candidate in 60 seconds',
    'Why should we hire Vishal?',
    'Show his AI and LLM project experience',
    'What is his data engineering background?',
    'What makes him stand out from other candidates?',
    'Is he available for roles in London?',
    'What industries has he worked in?',
    'What are his career goals for the next 2 years?',
    'What value can he bring to our team?',
    'What is his strongest technical skill?',
    'How has he demonstrated impact in previous roles?',
    'Does he have Generative AI experience?',
    'What is his experience with LLMs and RAG?',
    'What kind of role is he looking for?',
    'What is his educational background?',
    'Tell me about his work at Teleperformance',
    'What certifications does he hold?',
    'What is his MSc thesis about?',
    'What projects has he built end to end?',
    'Does he have experience with cloud platforms?',
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
