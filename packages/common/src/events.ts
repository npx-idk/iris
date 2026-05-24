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
