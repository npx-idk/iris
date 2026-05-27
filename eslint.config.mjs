import { config } from "@iris/eslint-config/base";

export default [
  ...config,
  {
    ignores: [
      "dist/**",
      ".next/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/*.js",
      "**/*.mjs",
    ],
  },
];
