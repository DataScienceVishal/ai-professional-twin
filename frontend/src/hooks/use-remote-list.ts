import { useEffect, useState } from 'react'

interface RemoteList<T> {
  items: T[]
  loading: boolean
}

/**
 * Fetch a read-only list once on mount.
 *
 * The request is aborted on unmount and no state is written afterwards - these
 * lists render inside the chat empty state, which unmounts the moment the
 * first message is sent, so an in-flight request is the normal case.
 *
 * Failures (network error, non-OK response, abort) collapse to an empty list.
 * Callers render nothing at all for an empty list rather than an error box:
 * these sections are supplementary to the chat, and a broken panel is worse
 * than no panel.
 */
export function useRemoteList<T>(
  fetcher: (signal?: AbortSignal) => Promise<T[]>,
): RemoteList<T> {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    const settle = (next: T[]) => {
      if (controller.signal.aborted) return
      setItems(next)
      setLoading(false)
    }

    fetcher(controller.signal)
      .then((data) => settle(Array.isArray(data) ? data : []))
      .catch(() => settle([]))

    return () => controller.abort()
  }, [fetcher])

  return { items, loading }
}
