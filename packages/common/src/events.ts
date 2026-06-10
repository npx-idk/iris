/** Emitted whenever any run in a workspace changes status (queued/running/finished). */
export const WORKSPACE_RUN_CHANGED = "workspace.run.changed"

/** Wildcard patterns for @OnEvent listeners matching the EVENTS emitters below. */
export const EVENT_PATTERNS = {
  RUN_FRAME: "run.*.frame",
  RUN_STEP: "run.*.step",
  RUN_STARTED: "run.*.started",
  RUN_COMPLETED: "run.*.completed",
  AUTHOR_READY: "author.*.ready",
  AUTHOR_STEP_STARTED: "author.*.step.started",
  AUTHOR_STEP_COMPLETED: "author.*.step.completed",
  AUTHOR_BROWSER: "author.*.browser",
  AUTHOR_TABS: "author.*.tabs",
} as const

export const EVENTS = {
  RUN_FRAME: (id: string) => `run.${id}.frame`,
  RUN_STEP: (id: string) => `run.${id}.step`,
  RUN_STARTED: (id: string) => `run.${id}.started`,
  RUN_COMPLETED: (id: string) => `run.${id}.completed`,
  AUTHOR_READY: (id: string) => `author.${id}.ready`,
  AUTHOR_STEP_STARTED: (id: string) => `author.${id}.step.started`,
  AUTHOR_STEP_COMPLETED: (id: string) => `author.${id}.step.completed`,
  AUTHOR_BROWSER: (id: string) => `author.${id}.browser`,
  AUTHOR_TABS: (id: string) => `author.${id}.tabs`,
} as const
