import { render } from '@testing-library/react'
import { useState, type ReactNode } from 'react'
import { SheetContext, type SheetState } from '../components/sheet/sheet-context'
import type { SourceInfo } from '../lib/types'

// Only tests import this file, so React fast refresh never applies to it.
// oxlint-disable-next-line react/only-export-components
function SheetProvider({ children, value }: { children: ReactNode; value: Partial<SheetState> }) {
  const [focused, setFocused] = useState<SourceInfo | null>(value.focused ?? null)
  return (
    <SheetContext.Provider value={{ record: null, trailing: {}, ...value, focused, setFocused }}>
      {children}
    </SheetContext.Provider>
  )
}

/** Render inside a working SheetContext whose focus really toggles. */
export function renderWithSheet(ui: ReactNode, value: Partial<SheetState> = {}) {
  return render(<SheetProvider value={value}>{ui}</SheetProvider>)
}
