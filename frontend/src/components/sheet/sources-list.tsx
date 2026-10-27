import { PROFILE } from '../../lib/constants'

// The local files `load_all_knowledge` in backend/app/rag/chunker.py reads, named as it names them.
const FILES = [
  'projects.yaml',
  'skills.yaml',
  'academics.yaml',
  'certificates.yaml',
  'career_qa.yaml',
  'linkedin.yaml',
  'resume.pdf',
]

export function SourcesList() {
  return (
    <section aria-labelledby="sources-heading" className="min-w-0">
      <h2 id="sources-heading" className="sheet-label mb-2">
        Sources
      </h2>
      <p className="text-base lg:text-[15px]">
        The assistant reads these files and his{' '}
        <a
          href={PROFILE.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="py-1 text-survey underline underline-offset-2"
        >
          public GitHub repositories
        </a>
        :
      </p>
      <ul role="list" className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        {FILES.map((file) => (
          <li key={file}>
            <code>{file}</code>
          </li>
        ))}
      </ul>
    </section>
  )
}
