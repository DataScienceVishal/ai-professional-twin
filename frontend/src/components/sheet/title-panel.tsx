import type { Ref } from 'react'
import { PROFILE, ROLE_LINE, SHEET_FACTS } from '../../lib/constants'
import { ContactLinks } from './contact-bar'

const BUTTON = 'flex-1 border-[1.5px] border-ink py-2.5 text-center font-semibold tracking-wide'

/** A no-break space before each middle dot keeps it on the line it closes, as the Builds rows do. */
function keepDots(text: string): string {
  return text.replaceAll(' · ', '\u00a0· ')
}

/** `ref` reaches the row of contact links, so the page can bring the contact bar back the moment that row leaves view. */
export function TitlePanel({ ref }: { ref?: Ref<HTMLDivElement> }) {
  return (
    <section aria-labelledby="sheet-title" className="min-w-0 border-[1.5px] border-ink bg-paper p-5 sm:p-6">
      {/* One photo, placed by the grid: beside the name on phones, so the facts get
          the full width and the recorded answer starts higher; beside the facts from sm. */}
      <div className="grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-x-3 sm:grid-cols-[88px_minmax(0,1fr)] sm:items-start sm:gap-x-4">
        <h1
          id="sheet-title"
          className="col-start-2 row-start-1 text-4xl font-semibold uppercase leading-none tracking-[0.06em] sm:col-span-2 sm:col-start-1 sm:text-5xl lg:text-6xl"
        >
          {PROFILE.name}
        </h1>
        <p className="col-span-2 row-start-2 mt-2 text-lg sm:text-xl">{keepDots(ROLE_LINE)}</p>
        <img
          src={PROFILE.avatarUrl}
          // The name sits beside the photo as the page heading.
          alt=""
          width={88}
          height={88}
          className="col-start-1 row-start-1 h-16 w-16 border-[1.5px] border-ink object-cover sm:row-start-3 sm:mt-4 sm:h-[88px] sm:w-[88px]"
        />
        <dl
          data-facts
          className="col-span-2 row-start-3 mt-4 grid min-w-0 grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1.5 text-base leading-snug sm:col-span-1 sm:col-start-2 lg:text-[15px]"
        >
          {SHEET_FACTS.map((fact) => (
            <div key={fact.label} className="contents">
              <dt className="pt-0.5 text-[11px] uppercase tracking-[0.14em] text-muted">{fact.label}</dt>
              <dd className="min-w-0 break-words">{keepDots(fact.value)}</dd>
            </div>
          ))}
        </dl>
      </div>
      {/* Phones get these from the contact bar, which never scrolls away. */}
      <div ref={ref} className="mt-5 hidden gap-2 lg:flex">
        <ContactLinks linkClassName={BUTTON} />
      </div>
      <a
        href={PROFILE.githubUrl}
        target="_blank"
        rel="noopener noreferrer"
        // Phones find his GitHub in Sources, so the recorded answer starts higher there.
        className="mt-3 hidden min-h-11 items-center text-sm text-survey underline underline-offset-2 sm:inline-flex lg:min-h-6"
      >
        Public repositories on GitHub
      </a>
    </section>
  )
}
