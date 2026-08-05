import { AVAILABILITY, CONTACT_MAILTO, PROFILE } from '../../lib/constants'
import { getResumeDownloadUrl } from '../../lib/api'

const PRIMARY_LINK =
  'flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 ' +
  'bg-accent-cyan/15 border border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/25 ' +
  'px-3 py-1.5 text-xs'

const QUIET_LINK =
  'flex items-center gap-1.5 text-xs text-text-secondary hover:text-accent-cyan transition-colors'

function MailIcon() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  )
}

interface ContactCtaProps {
  /** Optional heading override. */
  title?: string
  className?: string
}

/**
 * Conversion path for recruiters: a pre-filled mailto plus the two links a
 * recruiter reaches for next (LinkedIn and the CV download).
 */
export function ContactCta({ title = 'Hiring?', className = '' }: ContactCtaProps) {
  return (
    <div
      className={`flex flex-col gap-2.5 rounded-xl border border-accent-cyan/25 bg-accent-cyan/5 p-3 ${className}`}
    >
      <div>
        <p className="text-xs font-semibold text-text-primary">{title}</p>
        <p className="mt-1 text-[11px] leading-snug text-text-secondary">{AVAILABILITY}</p>
      </div>

      <a href={CONTACT_MAILTO} className={PRIMARY_LINK}>
        <MailIcon />
        Get in touch
      </a>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <a
          href={PROFILE.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={QUIET_LINK}
        >
          <LinkedInIcon />
          LinkedIn
        </a>
        <a
          href={getResumeDownloadUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className={QUIET_LINK}
        >
          <DownloadIcon />
          Download CV
        </a>
      </div>
    </div>
  )
}

/** Single icon-button for the mobile header, where the sidebar is hidden. */
export function ContactCtaCompact() {
  return (
    <a
      href={CONTACT_MAILTO}
      className="flex items-center gap-1.5 rounded-md border border-accent-cyan/30 bg-accent-cyan/15 px-2 py-1 text-xs font-medium text-accent-cyan transition-colors hover:bg-accent-cyan/25"
    >
      <MailIcon />
      Hire
    </a>
  )
}
