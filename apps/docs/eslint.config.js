import { nextJsConfig } from "@iris/eslint-config/next-js"

/** @type {import("eslint").Linter.Config[]} */
export default [
  // fumadocs-mdx generated output — not hand-written code
  { ignores: [".source/**"] },
  ...nextJsConfig,
]
