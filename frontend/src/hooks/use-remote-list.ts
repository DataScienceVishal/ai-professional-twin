import { useEffect, useState } from 'react'

interface RemoteList<T> {
  items: T[]
  loading: boolean
}

/**
 * Fetch a read-only list once on mount.
 *
 * Home fetches these lists once for the whole page, so they outlive the first
 * question. The request is aborted, and no state is written, only if the page
 * unmounts before it settles.
 *
 * Failures (network error, non-OK response, abort) collapse to an empty list,
 * which callers render as nothing rather than an error box: a broken panel
 * is worse than no panel.
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
