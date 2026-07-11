import { motion } from 'framer-motion'
import { Button } from '../ui/button'

interface InterviewPanelProps {
  onAction: (message: string) => void
}

const CATEGORIES = [
  {
    name: 'RAG & Retrieval',
    questions: [
      'Explain the RAG architecture in this project',
      'How does hybrid search work here?',
      'What chunking strategy did you use and why?',
    ],
  },
  {
    name: 'System Design',
    questions: [
      'Walk through the FastAPI backend architecture',
      'How do you handle streaming responses?',
      'What are the key engineering tradeoffs?',
    ],
  },
  {
    name: 'ML & AI',
    questions: [
      'Explain your reinforcement learning research',
      'How do embeddings work in this system?',
      'What prompt engineering techniques do you use?',
    ],
  },
]

export function InterviewPanel({ onAction }: InterviewPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="hidden xl:flex flex-col w-64 border-l border-border bg-bg-secondary p-4 gap-4 overflow-y-auto"
    >
      <h3 className="text-sm font-semibold text-text-primary">Technical Questions</h3>
      {CATEGORIES.map((cat) => (
        <div key={cat.name} className="flex flex-col gap-1.5">
          <p className="text-xs uppercase tracking-wider text-text-muted font-medium">
            {cat.name}
          </p>
          {cat.questions.map((q) => (
            <Button
              key={q}
              variant="ghost"
              size="sm"
              onClick={() => onAction(q)}
              className="w-full text-left justify-start text-xs"
            >
              {q}
            </Button>
          ))}
        </div>
      ))}
    </motion.div>
  )
}
