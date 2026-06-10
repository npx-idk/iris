import { describe, expect, it } from "vitest"
import { topologicalSort, wouldCreateCycle } from "./prerequisite.util"

function prereqsFrom(graph: Record<string, string[]>) {
  return async (id: string) => graph[id] ?? []
}

describe("wouldCreateCycle", () => {
  it("rejects a test as its own prerequisite", async () => {
    expect(await wouldCreateCycle("a", "a", prereqsFrom({}))).toBe(true)
  })

  it("detects a direct cycle", async () => {
    // b already requires a; making b a prereq of a closes the loop
    expect(await wouldCreateCycle("a", "b", prereqsFrom({ b: ["a"] }))).toBe(
      true
    )
  })

  it("detects a transitive cycle", async () => {
    expect(
      await wouldCreateCycle("a", "c", prereqsFrom({ c: ["b"], b: ["a"] }))
    ).toBe(true)
  })

  it("allows an acyclic prerequisite", async () => {
    expect(
      await wouldCreateCycle("a", "b", prereqsFrom({ b: ["c"], c: [] }))
    ).toBe(false)
  })
})

describe("topologicalSort", () => {
  it("orders prerequisites before their dependents", () => {
    const order = topologicalSort([
      { id: "checkout", prerequisites: [{ id: "login" }] },
      { id: "login", prerequisites: [] },
    ])
    expect(order.indexOf("login")).toBeLessThan(order.indexOf("checkout"))
  })

  it("drops tests whose prerequisite is missing from the list", () => {
    const order = topologicalSort([
      { id: "checkout", prerequisites: [{ id: "disabled-login" }] },
      { id: "browse", prerequisites: [] },
    ])
    expect(order).toEqual(["browse"])
  })
})
