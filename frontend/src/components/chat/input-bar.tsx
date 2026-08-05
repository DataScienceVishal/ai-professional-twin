import { type FormEvent, useRef, useState } from 'react'

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
    <form
      onSubmit={handleSubmit}
      // `pb` clears the iOS home indicator when the page opts into the safe
      // area; it falls back to the normal 1rem everywhere else.
      className="flex shrink-0 gap-2 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={disabled ? 'Thinking...' : 'Ask me anything about Vishal...'}
        autoFocus
        // 16px text stops iOS Safari from zooming the viewport on focus.
        className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-bg-card px-4 py-2.5 text-base text-text-primary transition-all placeholder:text-text-muted focus:border-accent-cyan/40 focus:outline-none focus:ring-1 focus:ring-accent-cyan/20 lg:text-sm"
      />
      {disabled && onStop ? (
        <button
          type="button"
          onClick={onStop}
          className="min-h-11 shrink-0 rounded-lg border border-border bg-bg-card px-4 py-2.5 text-sm font-medium text-text-secondary transition-all hover:border-accent-cyan/30 hover:text-accent-cyan"
        >
          Stop
        </button>
      ) : (
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="min-h-11 shrink-0 rounded-lg border border-accent-cyan/30 bg-accent-cyan/15 px-4 py-2.5 text-sm font-medium text-accent-cyan transition-all hover:bg-accent-cyan/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send
        </button>
      )}
    </form>
  )
}
