import { type FormEvent, useRef, useState } from 'react'

interface InputBarProps {
  onSend: (message: string) => void
  disabled?: boolean
}

export function InputBar({ onSend, disabled }: InputBarProps) {
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
    <form onSubmit={handleSubmit} className="flex gap-2 p-4 border-t border-border">
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={disabled ? 'Thinking...' : 'Ask me anything about Vishal...'}
        autoFocus
        className="flex-1 rounded-lg bg-bg-card border border-border px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan/40 focus:ring-1 focus:ring-accent-cyan/20 transition-all"
      />
      <button
        type="submit"
        disabled={disabled || !input.trim()}
        className="rounded-lg bg-accent-cyan/15 border border-accent-cyan/30 text-accent-cyan px-4 py-2.5 text-sm font-medium hover:bg-accent-cyan/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        Send
      </button>
    </form>
  )
}
