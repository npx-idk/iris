import { topoSort } from "../common/utils/topo-sort.util"

export async function wouldCreateCycle(
  testId: string,
  newPrereqId: string,
  getPrereqs: (id: string) => Promise<string[]>
): Promise<boolean> {
  if (newPrereqId === testId) return true

  const visited = new Set<string>()
  const queue = [newPrereqId]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)

    const prereqs = await getPrereqs(current)

    for (const prereqId of prereqs) {
      if (prereqId === testId) return true
      if (!visited.has(prereqId)) queue.push(prereqId)
    }
  }

  return false
}

export function topologicalSort(
  tests: Array<{ id: string; prerequisites: Array<{ id: string }> }>
): string[] {
  return topoSort(
    tests.map((t) => t.id),
    tests.flatMap((t) => t.prerequisites.map((p) => ({ from: p.id, to: t.id })))
  )
}
