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
    'What makes him stand out from other candidates?',
    'What is his current visa status?',
    'Will he require visa sponsorship?',
    'When is he available to start?',
    'Are there restrictions on his right to work?',
    'What kind of role is he looking for?',
    'Is he available for roles in London?',
    'What is his data engineering background?',
    'What industries has he worked in?',
    'How has he demonstrated impact in previous roles?',
    'Does he have Generative AI experience?',
    'What is his educational background?',
    'Tell me about his work at Teleperformance',
    'What are his career goals for the next 2 years?',
    'What is his MSc thesis about?',
    'What certifications does he hold?',
    'Does he have experience with cloud platforms?',
    'What projects has he built end to end?',
  ],
  interview: [
    'Explain the RAG architecture in this project',
    'How does the retrieval pipeline work?',
    'Walk through the FastAPI backend design',
    'What engineering tradeoffs did you make?',
    'Explain the prompt engineering approach',
    'How do embeddings work in this system?',
    'What chunking strategy did you use and why?',
    'Why did you choose dense vector search over BM25?',
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
    'What are the limitations of this assistant approach?',
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
  avatarUrl: 'https://github.com/DataScienceVishal.png',
  githubUrl: 'https://github.com/DataScienceVishal',
  linkedinUrl: 'https://www.linkedin.com/in/vishalkhandatascience/',
  email: 'vishalkhan251@gmail.com',
}

const CONTACT_SUBJECT = 'AI/ML opportunity for Vishal Khan'

const CONTACT_BODY = [
  'Hi Vishal,',
  '',
  "I came across your AI twin and I'd like to talk about a role.",
  '',
  'Role:',
  'Company:',
  'Location:',
  'Start date:',
  '',
  'Best regards,',
].join('\n')

/** `mailto:` link with a pre-filled subject and a short recruiter template. */
export const CONTACT_MAILTO = `mailto:${PROFILE.email}?subject=${encodeURIComponent(
  CONTACT_SUBJECT,
)}&body=${encodeURIComponent(CONTACT_BODY)}`

/** The role line as approved on 12 Oct 2026. */
export const ROLE_LINE = 'Seeking AI engineer roles · four years in data'

/** The title panel's facts. Each restates the knowledge-base entry named beside it. */
export const SHEET_FACTS: readonly { label: string; value: string }[] = [
  // career_qa.yaml `availability`
  { label: 'Available', value: 'Full-time from January 2027 · part-time and internships now' },
  // career_qa.yaml `sponsorship`, which opens "Not to start."
  { label: 'Visa', value: 'Right to work now · no sponsorship needed to start' },
  // academics.yaml, the Northeastern entry
  { label: 'Now', value: 'MSc AI and Computer Science, Northeastern University London, to January 2027' },
]

/** Full-time availability starts January 2027 (career_qa.yaml `availability`). */
export const FULL_TIME_FROM = 2027
export const FULL_TIME_LABEL = 'Full-time from Jan 2027'

/**
 * Short map labels, keyed by an entry's full title. Most come from the sheet
 * sketch Vishal chose on 12 Oct 2026. An entry not listed keeps its generated
 * short form.
 */
export const MAP_LABELS: Readonly<Record<string, string>> = {
  'MSc Artificial Intelligence & Computer Science, Northeastern University London': 'Northeastern MSc AI and CS',
  'MSc Data Science, Liverpool John Moores University (LJMU)': 'LJMU MSc Data Science',
  'Executive Post Graduate Programme in Data Science, International Institute of Information Technology Bangalore (IIIT-B)':
    'IIIT Bangalore PG',
  'Senior School Certificate (Class 12 / CBSE), Sarvodaya Bal Vidyalaya No 2 C Block Janakpuri, Delhi': 'Class 12 / CBSE',
  'Secondary School Certificate (Class 10 / CBSE), Angel Public School, Om Vihar, Uttam Nagar, Delhi': 'Class 10 / CBSE',
  'Finance/Accounts/Taxation, PJRJ Associates': 'Finance, PJRJ Associates',
  'E-commerce & Finance Executive, Aryan Care Pvt. Ltd.': 'E-commerce, Aryan Care',
  'Executive, Avant Garde Clean Room & Engg. Solutions Pvt. Ltd.': 'Executive, Avant Garde',
  'Data Engineer, Teleperformance Global Business Pvt. Ltd.': 'Data Engineer, Teleperformance',
}

export interface Suggestion {
  label: string
  message: string
  group?: string
}

/** The recruiter quick actions, moved here from the old side panel unchanged. */
export const RECRUITER_ACTIONS: readonly Suggestion[] = [
  { label: 'Summarize Vishal in 60 seconds', message: 'Give me a 60-second summary of Vishal Khan as a candidate.' },
  { label: 'Why hire Vishal?', message: 'Why should we hire Vishal Khan?' },
  { label: 'Show AI projects', message: "Show me Vishal's AI and LLM projects with details." },
  {
    label: 'Data Engineering experience',
    message: "Tell me about Vishal's data engineering experience at Teleperformance.",
  },
  {
    label: 'Generate interview questions',
    message: "Generate 5 technical interview questions based on Vishal's background.",
  },
]

/** The interview panel's questions, moved here unchanged with their categories and in their old order. */
export const INTERVIEW_STARTERS: readonly Suggestion[] = [
  {
    group: 'RAG & Retrieval',
    questions: [
      'Explain the RAG architecture in this project',
      'Why did you choose dense vector search over BM25?',
      'What chunking strategy did you use and why?',
    ],
  },
  {
    group: 'System Design',
    questions: [
      'Walk through the FastAPI backend architecture',
      'How do you handle streaming responses?',
      'What are the key engineering tradeoffs?',
    ],
  },
  {
    group: 'ML & AI',
    questions: [
      'Explain your reinforcement learning research',
      'How do embeddings work in this system?',
      'What prompt engineering techniques do you use?',
    ],
  },
].flatMap(({ group, questions }) =>
  questions.map((question) => ({ label: question, message: question, group })),
)

/**
 * Before the first question the Recruiter and Interview layers show their
 * curated lists in full. After that, and always on the General layer,
 * `count` shuffled chips keep the suggestions moving. `seed` is the messages
 * so far plus one, so seed 1 means no question has been asked yet.
 */
export function getLayerSuggestions(mode: ChatMode, seed: number, count = 5): Suggestion[] {
  if (seed === 1 && mode === 'recruiter') return [...RECRUITER_ACTIONS]
  if (seed === 1 && mode === 'interview') return [...INTERVIEW_STARTERS]
  return getShuffledChips(mode, seed, count).map((chip) => ({ label: chip, message: chip }))
}
