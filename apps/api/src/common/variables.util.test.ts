import { describe, expect, it } from "vitest"
import { interpolateVariables } from "./variables.util"

describe("interpolateVariables", () => {
  it("replaces known variables", () => {
    expect(
      interpolateVariables("Login as {{email}}", { email: "a@b.com" })
    ).toBe("Login as a@b.com")
  })

  it("replaces multiple occurrences and variables", () => {
    expect(
      interpolateVariables("{{a}} and {{b}} and {{a}}", { a: "1", b: "2" })
    ).toBe("1 and 2 and 1")
  })

  it("leaves unknown variables untouched", () => {
    expect(interpolateVariables("Use {{missing}}", {})).toBe("Use {{missing}}")
  })

  it("returns plain text unchanged", () => {
    expect(interpolateVariables("No variables here", { a: "1" })).toBe(
      "No variables here"
    )
  })
})
