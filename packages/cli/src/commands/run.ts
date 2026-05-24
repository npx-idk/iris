import { IrisClient, RunSummary } from '../lib/client'
import { log, err, fmt, printRunResult, printFinalSummary } from '../lib/output'

interface RunOptions {
  project?: string
  test?: string
  url?: string
  key?: string
  poll: string
  timeout: string
}

const TERMINAL_STATUSES = new Set(['PASSED', 'FAILED', 'CANCELLED'])

export async function runCommand(opts: RunOptions): Promise<void> {
  const apiUrl = (opts.url ?? '').replace(/\/$/, '')
  const apiKey = opts.key ?? ''

  if (!apiUrl) { err('Error: --url or IRIS_URL is required'); process.exit(1) }
  if (!apiKey) { err('Error: --key or IRIS_KEY is required'); process.exit(1) }
  if (!opts.project && !opts.test) { err('Error: --project or --test is required'); process.exit(1) }

  const client = new IrisClient(apiUrl, apiKey)
  const pollMs = Math.max(1000, parseInt(opts.poll, 10) || 3000)
  const timeoutMs = parseInt(opts.timeout, 10) || 600_000

  // ── Trigger ─────────────────────────────────────────────────────────────────

  let runIds: string[]

  try {
    if (opts.project) {
      log(fmt.cyan(`Triggering project ${opts.project}…`))
      const res = await client.triggerProject(opts.project)
      runIds = res.runIds
      log(fmt.gray(`Queued ${runIds.length} test(s)  ·  projectRunId: ${res.projectRunId}`))
    } else {
      log(fmt.cyan(`Triggering test ${opts.test}…`))
      const res = await client.triggerTest(opts.test!)
      runIds = [res.runId]
      log(fmt.gray(`Queued  ·  runId: ${res.runId}`))
    }
  } catch (e: any) {
    err(`\nFailed to trigger run: ${e.message}`)
    process.exit(1)
  }

  log('')

  // ── Poll ─────────────────────────────────────────────────────────────────────

  const deadline = Date.now() + timeoutMs
  const completed = new Map<string, RunSummary>()
  const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  let spinIdx = 0

  // Track which runs we've already printed results for
  const printed = new Set<string>()
  const pollFailures = new Map<string, number>()

  // Inline spinner while waiting (TTY only)
  let spinnerInterval: ReturnType<typeof setInterval> | undefined
  if (process.stdout.isTTY) {
    spinnerInterval = setInterval(() => {
      const pending = runIds.filter((id) => !completed.has(id)).length
      process.stdout.write(`\r${spinner[spinIdx % spinner.length]} ${fmt.gray(`Waiting for ${pending} run(s)…`)}   `)
      spinIdx++
    }, 80)
  }

  const clearSpinner = () => {
    if (spinnerInterval) {
      clearInterval(spinnerInterval)
      spinnerInterval = undefined
      if (process.stdout.isTTY) process.stdout.write('\r\x1b[K')
    }
  }

  while (completed.size < runIds.length) {
    if (Date.now() > deadline) {
      clearSpinner()
      err(`\nTimeout: runs did not complete within ${timeoutMs / 1000}s`)
      process.exit(1)
    }

    for (const runId of runIds) {
      if (completed.has(runId)) continue
      try {
        const run = await client.getRun(runId)
        if (TERMINAL_STATUSES.has(run.status) && !printed.has(runId)) {
          clearSpinner()
          printRunResult(run)
          completed.set(runId, run)
          printed.add(runId)
          // Restart spinner if more runs remain
          if (completed.size < runIds.length && process.stdout.isTTY) {
            spinnerInterval = setInterval(() => {
              const pending = runIds.filter((id) => !completed.has(id)).length
              process.stdout.write(`\r${spinner[spinIdx % spinner.length]} ${fmt.gray(`Waiting for ${pending} run(s)…`)}   `)
              spinIdx++
            }, 80)
          }
        }
      } catch (e: any) {
        const failures = (pollFailures.get(runId) ?? 0) + 1
        pollFailures.set(runId, failures)
        if (failures === 3) {
          clearSpinner()
          err(fmt.yellow(`Warning: poll for run ${runId} has failed ${failures} times — ${e?.message ?? e}`))
        }
      }
    }

    if (completed.size < runIds.length) {
      await new Promise((r) => setTimeout(r, pollMs))
    }
  }

  clearSpinner()

  // ── Summary ──────────────────────────────────────────────────────────────────

  const allRuns = [...completed.values()]
  printFinalSummary(allRuns)

  const anyFailed = allRuns.some((r) => r.status !== 'PASSED')
  process.exit(anyFailed ? 1 : 0)
}
