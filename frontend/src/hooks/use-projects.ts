import { fetchProjects } from '../lib/api'
import { useRemoteList } from './use-remote-list'
import type { Project } from '../lib/types'

export function useProjects() {
  const { items, loading } = useRemoteList<Project>(fetchProjects)
  return { projects: items, loading }
}
