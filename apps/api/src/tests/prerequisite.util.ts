export async function wouldCreateCycle(
  testId: string,
  newPrereqId: string,
  getPrereqs: (id: string) => Promise<string[]>,
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
  tests: Array<{ id: string; prerequisites: Array<{ id: string }> }>,
): string[] {
  const inDegree = new Map<string, number>()
  const dependents = new Map<string, string[]>()

  for (const test of tests) {
    if (!inDegree.has(test.id)) inDegree.set(test.id, 0)
    if (!dependents.has(test.id)) dependents.set(test.id, [])

    for (const prereq of test.prerequisites) {
      inDegree.set(test.id, (inDegree.get(test.id) ?? 0) + 1)
      if (!dependents.has(prereq.id)) dependents.set(prereq.id, [])
      dependents.get(prereq.id)!.push(test.id)
    }
  }

  const queue = [...inDegree.entries()]
    .filter(([, deg]) => deg === 0)
    .map(([id]) => id)

  const result: string[] = []

  while (queue.length > 0) {
    const id = queue.shift()!
    result.push(id)

    for (const dependentId of dependents.get(id) ?? []) {
      const newDegree = (inDegree.get(dependentId) ?? 0) - 1
      inDegree.set(dependentId, newDegree)
      if (newDegree === 0) queue.push(dependentId)
    }
  }

  return result
}
