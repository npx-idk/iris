// Minimal ANSI helpers — no dependencies
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
}

const noColor = !!process.env.NO_COLOR || !process.stdout.isTTY

function paint(code: string, text: string): string {
  return noColor ? text : `${code}${text}${c.reset}`
}

export const fmt = {
  bold: (s: string) => paint(c.bold, s),
  dim: (s: string) => paint(c.dim, s),
  green: (s: string) => paint(c.green, s),
  red: (s: string) => paint(c.red, s),
  yellow: (s: string) => paint(c.yellow, s),
  cyan: (s: string) => paint(c.cyan, s),
  gray: (s: string) => paint(c.gray, s),
}

export function log(msg: string) {
  process.stdout.write(msg + '\n')
}

export function err(msg: string) {
  process.stderr.write(msg + '\n')
}

export function printRunResult(run: import('./client').RunSummary) {
  const icon = run.status === 'PASSED' ? fmt.green('✓') : fmt.red('✗')
  const name = fmt.bold(run.test?.name ?? run.id)
  const status = run.status === 'PASSED'
    ? fmt.green(run.status)
    : run.status === 'CANCELLED'
      ? fmt.yellow(run.status)
      : fmt.red(run.status)

  const steps = `${run.passedSteps}/${run.totalSteps} steps`

  log(`${icon} ${name}  ${status}  ${fmt.gray(steps)}`)

  if (run.status !== 'PASSED') {
    for (const step of run.stepResults ?? []) {
      if (step.result !== 'FAILED') continue
      const label = step.description ?? step.instruction
      log(`  ${fmt.red('↳')} Step ${step.stepIndex + 1}: ${label}`)
      if (step.errorMessage) {
        log(`    ${fmt.gray(step.errorMessage)}`)
      }
    }
    if (run.errorMessage && !run.stepResults?.some((s) => s.result === 'FAILED')) {
      log(`  ${fmt.gray(run.errorMessage)}`)
    }
  }
}

export function printFinalSummary(runs: import('./client').RunSummary[]) {
  const passed = runs.filter((r) => r.status === 'PASSED').length
  const failed = runs.filter((r) => r.status === 'FAILED').length
  const cancelled = runs.filter((r) => r.status === 'CANCELLED').length

  log('')
  log('─'.repeat(48))
  const parts: string[] = []
  if (passed) parts.push(fmt.green(`${passed} passed`))
  if (failed) parts.push(fmt.red(`${failed} failed`))
  if (cancelled) parts.push(fmt.yellow(`${cancelled} cancelled`))
  log(parts.join(fmt.gray('  ·  ')))
}
