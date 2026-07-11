import { motion } from 'framer-motion'
import { Button } from '../ui/button'
import { getResumeDownloadUrl } from '../../lib/api'

interface RecruiterPanelProps {
  onAction: (message: string) => void
}

const ACTIONS = [
  { label: 'Summarize Vishal in 60 seconds', message: 'Give me a 60-second summary of Vishal Khan as a candidate.' },
  { label: 'Why hire Vishal?', message: 'Why should we hire Vishal Khan?' },
  { label: 'Show AI projects', message: 'Show me Vishal\'s AI and LLM projects with details.' },
  { label: 'Data Engineering experience', message: 'Tell me about Vishal\'s data engineering experience at Accenture.' },
  { label: 'Generate interview questions', message: 'Generate 5 technical interview questions based on Vishal\'s background.' },
]

export function RecruiterPanel({ onAction }: RecruiterPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="hidden xl:flex flex-col w-64 border-l border-border bg-bg-secondary p-4 gap-3"
    >
      <h3 className="text-sm font-semibold text-text-primary">Quick Actions</h3>
      {ACTIONS.map((action) => (
        <Button
          key={action.label}
          variant="secondary"
          size="sm"
          onClick={() => onAction(action.message)}
          className="w-full text-left justify-start"
        >
          {action.label}
        </Button>
      ))}
      <hr className="border-border" />
      <a
        href={getResumeDownloadUrl()}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Button variant="primary" size="sm" className="w-full">
          Download Resume
        </Button>
      </a>
    </motion.div>
  )
}
