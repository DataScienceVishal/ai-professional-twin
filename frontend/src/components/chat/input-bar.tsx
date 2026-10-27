import { type FormEvent, useRef, useState } from 'react'

/** Exported so the layer key can hand keyboard focus to the field. */
export const ASK_FIELD_ID = 'ask'

interface InputBarProps {
  onSend: (message: string) => void
  onStop?: () => void
  disabled?: boolean
}

export function InputBar({ onSend, onStop, disabled }: InputBarProps) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (input.trim() && !disabled) {
      onSend(input.trim())
      setInput('')
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <label htmlFor={ASK_FIELD_ID} className="sr-only">
        Ask about his record
      </label>
      <input
        id={ASK_FIELD_ID}
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={disabled ? 'Thinking...' : 'Ask about his record'}
        // 16px text stops iOS Safari from zooming the viewport on focus.
        className="min-h-11 min-w-0 flex-1 border-[1.5px] border-ink bg-paper px-3 py-2 text-base placeholder:text-muted"
      />
      {disabled && onStop ? (
        <button
          type="button"
          onClick={(event) => {
            onStop()
            // This button turns into a disabled Ask, which would drop focus
            // to the top of the page. A keyboard press (detail 0) hands focus
            // back to the field; a tap leaves it, so a phone keeps its
            // keyboard down.
            if (event.detail === 0) inputRef.current?.focus()
          }}
          className="min-h-11 shrink-0 border-[1.5px] border-ink px-5 font-semibold"
        >
          Stop
        </button>
      ) : (
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="min-h-11 shrink-0 bg-route px-6 font-semibold tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Ask
        </button>
      )}
    </form>
  )
}
