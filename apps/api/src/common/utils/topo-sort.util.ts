/**
 * Kahn's-algorithm topological sort over string node ids.
 *
 * Edges pointing at unknown ids are ignored; nodes that depend on an id
 * outside `ids` (or that sit on a cycle) are omitted from the result, so
 * callers can detect cycles by comparing lengths.
 */
export function topoSort(
  ids: string[],
  edges: Array<{ from: string; to: string }>
): string[] {
  const inDegree = new Map<string, number>(ids.map((id) => [id, 0]))
  const dependents = new Map<string, string[]>(ids.map((id) => [id, []]))

  for (const { from, to } of edges) {
    if (!inDegree.has(to)) continue
    inDegree.set(to, inDegree.get(to)! + 1)
    dependents.get(from)?.push(to)
  }

  const queue = ids.filter((id) => inDegree.get(id) === 0)
  const result: string[] = []

  while (queue.length > 0) {
    const id = queue.shift()!
    result.push(id)

    for (const next of dependents.get(id) ?? []) {
      const degree = inDegree.get(next)! - 1
      inDegree.set(next, degree)
      if (degree === 0) queue.push(next)
    }
  }

  return result
}
