import { CONTACT_MAILTO, PROFILE } from '../../lib/constants'
import { getResumeDownloadUrl } from '../../lib/api'

/** Email, LinkedIn and the CV, as both the contact bar and the title panel offer them. */
export function ContactLinks({ linkClassName }: { linkClassName: string }) {
  return (
    <>
      <a href={CONTACT_MAILTO} data-fill="ink" className={`${linkClassName} bg-ink text-paper`}>
        Email
      </a>
      <a href={PROFILE.linkedinUrl} target="_blank" rel="noopener noreferrer" className={linkClassName}>
        LinkedIn
      </a>
      <a href={getResumeDownloadUrl()} target="_blank" rel="noopener noreferrer" className={linkClassName}>
        CV (PDF)
      </a>
    </>
  )
}

interface ContactBarProps {
  /**
   * Phones always show the bar. On desktop the title panel carries the same
   * links, so the bar appears only once a conversation replaces that panel.
   */
  showOnDesktop: boolean
  /** On desktop the bar lies over the top of the first sheet when it appears, so showing it moves nothing. */
  overlay?: boolean
}

const LINK =
  'flex min-h-11 flex-1 items-center justify-center px-3 text-sm font-semibold tracking-wide lg:min-h-9 lg:flex-none lg:px-4'

export function ContactBar({ showOnDesktop, overlay = false }: ContactBarProps) {
  return (
    <nav
      aria-label="Contact"
      data-ring="inset"
      className={`shrink-0 border-b-[1.5px] border-ink bg-paper ${showOnDesktop ? 'flex' : 'flex lg:hidden'} ${
        overlay ? 'lg:fixed lg:inset-x-0 lg:top-0 lg:z-10' : ''
      }`}
    >
      <span className="hidden items-center px-4 text-sm font-semibold uppercase tracking-[0.18em] lg:flex">
        {PROFILE.name}
      </span>
      <div className="flex flex-1 divide-x divide-ink/20 lg:ml-auto lg:flex-none">
        <ContactLinks linkClassName={LINK} />
      </div>
    </nav>
  )
}
