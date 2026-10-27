import { useEffect, useLayoutEffect, useRef } from 'react'
import { ASK_FIELD_ID } from '../chat/input-bar'
import { getLayerSuggestions } from '../../lib/constants'
import type { ChatMode } from '../../lib/types'

interface LayerKeyProps {
  mode: ChatMode
  /** Messages so far plus one, so the shuffle changes after every question. */
  seed: number
  onSelect: (message: string) => void
  disabled?: boolean
}

/** Pixels per line, for wheels that report their movement in lines. */
const WHEEL_LINE = 16

export function LayerKey({ mode, seed, onSelect, disabled = false }: LayerKeyProps) {
  const suggestions = getLayerSuggestions(mode, seed)
  const listRef = useRef<HTMLUListElement>(null)

  // A new layer or a new shuffle starts from its first question.
  useLayoutEffect(() => {
    if (listRef.current) listRef.current.scrollLeft = 0
  }, [mode, seed])

  // A mouse wheel only moves vertically, and nothing else in the dock scrolls,
  // so over this row the wheel moves the questions sideways.
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return
      if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return
      if (list.scrollWidth <= list.clientWidth) return
      event.preventDefault()
      list.scrollLeft += event.deltaY * (event.deltaMode === WheelEvent.DOM_DELTA_LINE ? WHEEL_LINE : 1)
    }
    list.addEventListener('wheel', onWheel, { passive: false })
    return () => list.removeEventListener('wheel', onWheel)
  }, [])

  return (
    // One row at every width, scrolling inside its own box, so the dock keeps
    // its height in every layer. `p-1` keeps focus rings inside the box, and
    // `-m-1` cancels the space it adds.
    <ul
      ref={listRef}
      role="list"
      aria-label="Suggested questions"
      className="-m-1 flex min-w-0 gap-1.5 overflow-x-auto p-1 max-lg:no-scrollbar lg:scroll-frame lg:overflow-x-scroll"
    >
      {suggestions.map((suggestion, index) => (
        <li key={suggestion.message} className="flex shrink-0 items-center gap-1.5">
          {suggestion.group && suggestion.group !== suggestions[index - 1]?.group && (
            <span className="sheet-label whitespace-nowrap">{suggestion.group}</span>
          )}
          <button
            type="button"
            // Not `disabled`: a disabled button drops keyboard focus to
            // `<body>`, and the chips go inactive after every question.
            aria-disabled={disabled || undefined}
            onClick={(event) => {
              if (disabled) return
              onSelect(suggestion.message)
              // Sending reshuffles the key and unmounts this chip, which would drop focus
              // to `<body>`, so a keyboard press moves it to the ask field.
              if (event.detail === 0) document.getElementById(ASK_FIELD_ID)?.focus()
            }}
            onFocus={(event) => {
              const chip = event.currentTarget
              // Keyboard focus only: scrolling under a mouse press would move
              // the chip away before the click lands.
              if (chip.matches(':focus-visible')) chip.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
            }}
            className="min-h-11 scroll-mx-1 whitespace-nowrap border border-ink/50 px-3 text-xs hover:border-ink aria-disabled:cursor-not-allowed aria-disabled:opacity-40 lg:min-h-0 lg:py-1.5"
          >
            {suggestion.label}
          </button>
        </li>
      ))}
    </ul>
  )
}
