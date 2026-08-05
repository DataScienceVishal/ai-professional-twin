import { fetchSkills } from '../lib/api'
import { useRemoteList } from './use-remote-list'
import type { SkillCategory } from '../lib/types'

export function useSkills() {
  const { items, loading } = useRemoteList<SkillCategory>(fetchSkills)
  return { skills: items, loading }
}
