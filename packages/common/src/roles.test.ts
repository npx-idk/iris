import { describe, expect, it } from "vitest"
import { ASSIGNABLE_PROJECT_ROLES, PROJECT_ROLES, can } from "./roles"

describe("can", () => {
  it("lets everyone read", () => {
    for (const role of PROJECT_ROLES) {
      expect(can(role, "read")).toBe(true)
    }
  })

  it("lets MEMBER and above write, but not VIEWER", () => {
    expect(can("OWNER", "write")).toBe(true)
    expect(can("ADMIN", "write")).toBe(true)
    expect(can("MEMBER", "write")).toBe(true)
    expect(can("VIEWER", "write")).toBe(false)
  })

  it("lets ADMIN and above manage, but not MEMBER or VIEWER", () => {
    expect(can("OWNER", "manage")).toBe(true)
    expect(can("ADMIN", "manage")).toBe(true)
    expect(can("MEMBER", "manage")).toBe(false)
    expect(can("VIEWER", "manage")).toBe(false)
  })

  it("only lets OWNER delete the project", () => {
    expect(can("OWNER", "delete-project")).toBe(true)
    expect(can("ADMIN", "delete-project")).toBe(false)
    expect(can("MEMBER", "delete-project")).toBe(false)
    expect(can("VIEWER", "delete-project")).toBe(false)
  })
})

describe("ASSIGNABLE_PROJECT_ROLES", () => {
  it("never includes OWNER", () => {
    expect(ASSIGNABLE_PROJECT_ROLES).not.toContain("OWNER")
  })
})
