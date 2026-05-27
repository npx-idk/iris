import { z } from 'zod'
import { createStagehand, executeStep } from './agent'
import type { BrowserEnv } from './types'

export interface ExploreConfig {
  url: string
  context?: string
  env: BrowserEnv
  geminiApiKey: string
  browserbaseApiKey?: string
  browserbaseProjectId?: string
  /** Steps to run before exploring — used to authenticate into protected pages */
  prerequisite?: {
    startUrl?: string
    steps: Array<{ instruction: string }>
  }
  /** Workspace variable values for interpolating {{name}} tokens in prerequisite steps */
  variables?: Record<string, string>
}

export interface GeneratedTest {
  name: string
  description: string
  startUrl: string
  steps: Array<{ stepIndex: number; instruction: string }>
}

export interface ExploreResult {
  pagePurpose: string
  tests: GeneratedTest[]
}

// Phase 1: extract visible labels only — no DOM IDs, just user-facing text
const pageContentSchema = z.object({
  pageTitle: z.string(),
  pagePurpose: z.string(),
  fields: z.array(z.string()),   // visible labels/placeholders: ["Email", "Password"]
  buttons: z.array(z.string()),  // button text: ["Sign In", "Create account"]
  links: z.array(z.string()),    // link text: ["Forgot password?", "Sign up"]
})

// Phase 2: generate scenarios from the clean label list — never touches raw DOM
const scenariosSchema = z.object({
  scenarios: z.array(z.object({
    name: z.string(),
    description: z.string(),
    steps: z.array(z.string()),
  })),
})

function interpolateVars(s: string, vars: Record<string, string>): string {
  return s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`)
}

export async function explorePage(config: ExploreConfig): Promise<ExploreResult> {
  const stagehand = await createStagehand(config)
  await stagehand.init()

  try {
    const page = stagehand.context.activePage() ?? stagehand.context.pages()[0]
    if (!page) throw new Error('No active page available')

    // Run prerequisite steps (e.g. login) before exploring the target page
    if (config.prerequisite) {
      if (config.prerequisite.startUrl) {
        await page.goto(config.prerequisite.startUrl, { waitUntil: 'domcontentloaded', timeoutMs: 30000 })
        await page.waitForLoadState('domcontentloaded').catch(() => {})
      }
      for (const step of config.prerequisite.steps) {
        const instruction = interpolateVars(step.instruction, config.variables ?? {})
        const result = await executeStep(stagehand, instruction)
        if (!result.success) {
          throw new Error(
            `Prerequisite step failed: "${instruction}"` +
            (result.message ? ` — ${result.message}` : ''),
          )
        }
      }
      // Let post-login navigation settle before continuing
      await new Promise((r) => setTimeout(r, 1500))
    }

    await page.goto(config.url, { waitUntil: 'domcontentloaded', timeoutMs: 30000 })
    await page.waitForLoadState('domcontentloaded').catch(() => {})

    // Phase 1 — extract visible text labels only
    const pageContent = await stagehand.extract(
      'Extract the visible text of all interactive elements on this page: ' +
      'the page title or heading, the page purpose, all form field labels and placeholders, ' +
      'all button labels, and all link labels. Return only the visible text strings — no IDs, no selectors.',
      pageContentSchema as any,
    ) as z.infer<typeof pageContentSchema>

    // Phase 2 — generate scenarios using only the extracted label strings as input
    const elementSummary = [
      `Page: ${pageContent.pageTitle} — ${pageContent.pagePurpose}`,
      pageContent.fields.length  ? `Form fields: ${pageContent.fields.join(', ')}`   : '',
      pageContent.buttons.length ? `Buttons: ${pageContent.buttons.join(', ')}`       : '',
      pageContent.links.length   ? `Links: ${pageContent.links.join(', ')}`           : '',
      config.context             ? `Context: ${config.context}`                       : '',
    ].filter(Boolean).join('\n')

    const scenarioPrompt =
      `You are a senior QA engineer. Based on this page summary, generate 3 to 6 distinct test scenarios.\n\n` +
      `${elementSummary}\n\n` +
      `Cover: the happy path, error cases (invalid/missing inputs), and meaningful edge cases.\n` +
      `Write each step as a plain English instruction a human tester would read — ` +
      `use the exact visible label names listed above (e.g. "Fill the Email field with test@example.com", ` +
      `"Click the Sign In button", "Verify that an error message appears"). ` +
      `Never reference IDs, CSS classes, or any technical attributes.`

    const raw = await stagehand.extract(scenarioPrompt, scenariosSchema as any) as z.infer<typeof scenariosSchema>

    const tests: GeneratedTest[] = raw.scenarios.map((scenario) => ({
      name: scenario.name,
      description: scenario.description,
      startUrl: config.url,
      steps: scenario.steps.map((instruction, i) => ({ stepIndex: i, instruction })),
    }))

    return { pagePurpose: pageContent.pagePurpose, tests }
  } finally {
    await stagehand.close().catch(() => {})
  }
}
