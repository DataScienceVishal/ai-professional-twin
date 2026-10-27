import { createContext, useContext } from 'react'
import type { SheetRecord } from '../../lib/timeline'
import type { SourceInfo } from '../../lib/types'

export type TrailingTokens = Readonly<Partial<Record<string, readonly string[]>>>

export interface SheetState {
  record: SheetRecord | null
  /** Values that belong at the end of a source label, keyed by source kind. */
  trailing: TrailingTokens
  /** The source open on the sheet, if any. */
  focused: SourceInfo | null
  setFocused: (source: SourceInfo | null) => void
}

export const SheetContext = createContext<SheetState>({
  record: null,
  trailing: {},
  focused: null,
  setFocused: () => {},
})

export function useSheet(): SheetState {
  return useContext(SheetContext)
}

export function sameSource(a: SourceInfo | null, b: SourceInfo): boolean {
  return a !== null && a.source === b.source && a.detail === b.detail && a.url === b.url
}
