import { describe, expect, it } from "vitest"
import {
  buildTree,
  findNode,
  flattenTree,
  getDescendantIds,
} from "./folder-tree"
import type { Folder } from "./types"

const folder = (id: string, parentId: string | null = null): Folder =>
  ({ id, name: id, parentId }) as Folder

const folders = [
  folder("root-a"),
  folder("root-b"),
  folder("child-a1", "root-a"),
  folder("grandchild-a1x", "child-a1"),
]

describe("buildTree", () => {
  it("nests folders under their parents", () => {
    const tree = buildTree(folders)
    expect(tree.map((n) => n.id)).toEqual(["root-a", "root-b"])
    expect(tree[0]!.children[0]!.id).toBe("child-a1")
    expect(tree[0]!.children[0]!.children[0]!.id).toBe("grandchild-a1x")
  })
})

describe("flattenTree", () => {
  it("returns depth-first order with depths", () => {
    const flat = flattenTree(buildTree(folders))
    expect(flat.map((f) => [f.folder.id, f.depth])).toEqual([
      ["root-a", 0],
      ["child-a1", 1],
      ["grandchild-a1x", 2],
      ["root-b", 0],
    ])
  })
})

describe("getDescendantIds", () => {
  it("includes the node itself and all descendants", () => {
    const tree = buildTree(folders)
    expect([...getDescendantIds(tree[0]!)].sort()).toEqual(
      ["child-a1", "grandchild-a1x", "root-a"].sort()
    )
  })
})

describe("findNode", () => {
  it("finds nested nodes and returns null for unknown ids", () => {
    const tree = buildTree(folders)
    expect(findNode(tree, "grandchild-a1x")?.id).toBe("grandchild-a1x")
    expect(findNode(tree, "nope")).toBeNull()
  })
})
