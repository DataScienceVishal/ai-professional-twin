import { PROFILE, ROLE_LINE, SHEET_FACTS } from '../../lib/constants'
import { ContactLinks } from './contact-bar'

const BUTTON = 'flex-1 border-[1.5px] border-ink py-2.5 text-center font-semibold tracking-wide'

export function TitlePanel() {
  return (
    <section aria-labelledby="sheet-title" className="min-w-0 border-[1.5px] border-ink bg-paper p-5 sm:p-6">
      <p className="sheet-label">Sheet 1 · London</p>
      <h1
        id="sheet-title"
        className="mt-2 text-4xl font-semibold uppercase leading-none tracking-[0.06em] sm:text-5xl lg:text-6xl"
      >
        {PROFILE.name}
      </h1>
      <p className="mt-2 text-lg sm:text-xl">{ROLE_LINE}</p>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row">
        <img
          src={PROFILE.avatarUrl}
          alt={PROFILE.name}
          width={88}
          height={88}
          className="h-[88px] w-[88px] shrink-0 border-[1.5px] border-ink object-cover"
        />
        <dl data-facts className="grid min-w-0 grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1.5 text-base leading-snug lg:text-[15px]">
          {SHEET_FACTS.map((fact) => (
            <div key={fact.label} className="contents">
              <dt className="pt-0.5 text-[11px] uppercase tracking-[0.14em] text-muted">{fact.label}</dt>
              <dd className="min-w-0 break-words">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      {/* Phones get these from the contact bar, which never scrolls away. */}
      <div className="mt-5 hidden gap-2 lg:flex">
        <ContactLinks linkClassName={BUTTON} />
      </div>
      <a
        href={PROFILE.githubUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex min-h-11 items-center text-sm text-survey underline underline-offset-2 lg:min-h-6"
      >
        Public repositories on GitHub
      </a>
    </section>
  )
}
