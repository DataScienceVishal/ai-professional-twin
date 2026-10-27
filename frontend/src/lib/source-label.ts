export const SKILL_LEVELS = ['advanced', 'intermediate', 'working knowledge'] as const

/**
 * The backend joins a chunk's metadata values in whatever order the store
 * returns them, so one document can read "Machine Learning - Telecom Churn
 * Prediction" on one answer and the other way round on the next. A known
 * trailing value, such as a project category, a skill level or a degree, is
 * moved to the end.
 */
export function orderDetail(detail: string, trailing: readonly string[]): string {
  for (const token of trailing) {
    const prefix = `${token} - `
    if (token && detail.startsWith(prefix)) return `${detail.slice(prefix.length)} - ${token}`
  }
  return detail
}
