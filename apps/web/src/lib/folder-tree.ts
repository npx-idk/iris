import type { Folder } from "./types"

export interface FolderNode extends Folder {
  children: FolderNode[]
}

export function buildTree(
  folders: Folder[],
  parentId: string | null = null
): FolderNode[] {
  return folders
    .filter((f) => f.parentId === parentId)
    .map((f) => ({ ...f, children: buildTree(folders, f.id) }))
}

export function flattenTree(
  nodes: FolderNode[],
  depth = 0
): { folder: Folder; depth: number }[] {
  return nodes.flatMap((n) => [
    { folder: n, depth },
    ...flattenTree(n.children, depth + 1),
  ])
}

export function getDescendantIds(node: FolderNode): Set<string> {
  const ids = new Set<string>([node.id])
  for (const child of node.children)
    getDescendantIds(child).forEach((id) => ids.add(id))
  return ids
}

export function findNode(nodes: FolderNode[], id: string): FolderNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const found = findNode(n.children, id)
    if (found) return found
  }
  return null
}
