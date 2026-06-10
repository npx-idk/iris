import { describe, expect, it } from "vitest"
import { topoSort } from "./topo-sort.util"

describe("topoSort", () => {
  it("returns nodes in dependency order", () => {
    const order = topoSort(
      ["c", "a", "b"],
      [
        { from: "a", to: "b" },
        { from: "b", to: "c" },
      ]
    )
    expect(order).toEqual(["a", "b", "c"])
  })

  it("keeps independent nodes", () => {
    const order = topoSort(["a", "b", "c"], [{ from: "a", to: "b" }])
    expect(order).toHaveLength(3)
    expect(order.indexOf("a")).toBeLessThan(order.indexOf("b"))
  })

  it("omits nodes on a cycle so callers can detect it", () => {
    const order = topoSort(
      ["a", "b", "standalone"],
      [
        { from: "a", to: "b" },
        { from: "b", to: "a" },
      ]
    )
    expect(order).toEqual(["standalone"])
  })

  it("ignores edges pointing at unknown nodes", () => {
    const order = topoSort(["a"], [{ from: "a", to: "ghost" }])
    expect(order).toEqual(["a"])
  })

  it("omits nodes that depend on an id outside the list", () => {
    const order = topoSort(["a"], [{ from: "ghost", to: "a" }])
    expect(order).toEqual([])
  })

  it("handles diamond dependencies", () => {
    const order = topoSort(
      ["d", "b", "c", "a"],
      [
        { from: "a", to: "b" },
        { from: "a", to: "c" },
        { from: "b", to: "d" },
        { from: "c", to: "d" },
      ]
    )
    expect(order.indexOf("a")).toBe(0)
    expect(order.indexOf("d")).toBe(3)
  })
})
