import { useEffect, useState } from 'react'
import { fetchTimeline } from '../lib/api'
import type { Timeline } from '../lib/types'

/**
 * The dated record for the whole page. It lives above the first sheet and the
 * conversation alike, so it is fetched once and survives the first question.
 * A failure settles to null and the page simply draws no map.
 */
export function useTimeline() {
  const [timeline, setTimeline] = useState<Timeline | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    const settle = (next: Timeline | null) => {
      if (controller.signal.aborted) return
      setTimeline(next)
      setLoading(false)
    }
    fetchTimeline(controller.signal)
      .then(settle)
      .catch(() => settle(null))
    return () => controller.abort()
  }, [])

  return { timeline, loading }
}
