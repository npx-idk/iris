import { Stagehand } from "@browserbasehq/stagehand"
import { z } from "zod"
import {
  RunConfig,
  RunResult,
  StepLog,
  StepAction,
  RunMetrics,
  MetricsSnapshot,
  CacheStatus,
  StoredNetworkEntry,
  StoredConsoleEntry,
} from "./types"

const VERIFY_RE =
  /^\s*(verify|check|assert|confirm|ensure|validate|make\s+sure|is\s+there|are\s+there|does|should\s+be|should\s+see|should\s+have|should\s+not|must\s+be|must\s+have|varify)\b/i

function interpolate(
  instruction: string,
  vars: Record<string, string>
): string {
  return instruction.replace(
    /\{\{(\w+)\}\}/g,
    (_, key) => vars[key] ?? `{{${key}}}`
  )
}

const verifySchema = z.object({ met: z.boolean(), observation: z.string() })

type StepActResult = {
  success: boolean
  message?: string
  cacheStatus?: CacheStatus
  actions?: StepAction[]
}

// Routes verification instructions to extract(), action instructions to retryAct().
// Verification steps retry up to 3 times (2 s apart) to handle post-navigation delays.
export async function executeStep(
  stagehand: Stagehand,
  instruction: string,
  options?: { variables?: Record<string, string> }
): Promise<StepActResult> {
  if (VERIFY_RE.test(instruction)) {
    let lastMessage: string | undefined
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const page =
          stagehand.context.activePage() ?? stagehand.context.pages()[0]
        if (page) {
          await page.waitForLoadState("domcontentloaded").catch(() => {})
        }
        const result = (await stagehand.extract(
          instruction,
          verifySchema as any
        )) as { met: boolean; observation: string }
        if (result.met) return { success: true }
        lastMessage = result.observation
      } catch (err) {
        lastMessage = String(err)
      }
      if (attempt < 2) await new Promise((r) => setTimeout(r, 2000))
    }
    return { success: false, message: lastMessage }
  }
  return retryAct(stagehand, instruction, options)
}

const DEFAULT_MODEL = "google/gemini-2.5-flash"

function buildStagehandConfig(
  config: Pick<
    RunConfig,
    | "env"
    | "geminiApiKey"
    | "modelName"
    | "heliconeApiKey"
    | "heliconeBaseUrl"
    | "browserbaseApiKey"
    | "browserbaseProjectId"
  >
) {
  return {
    env: config.env,
    model: {
      modelName: (config.modelName ?? DEFAULT_MODEL) as any,
      apiKey: config.geminiApiKey,
      ...(config.heliconeApiKey && {
        baseURL:
          config.heliconeBaseUrl ?? "https://generativelanguage.hconeai.com",
        headers: { "Helicone-Auth": `Bearer ${config.heliconeApiKey}` },
      }),
    },
    ...(config.env === "BROWSERBASE" && {
      apiKey: config.browserbaseApiKey,
      projectId: config.browserbaseProjectId,
      serverCache: true,
      browserbaseSessionCreateParams: {
        browserSettings: {
          blockAds: true,
          solveCaptchas: true,
          recordSession: true,
          viewport: { width: 1280, height: 720 },
        },
      },
    }),
    ...(config.env === "LOCAL" && {
      localBrowserLaunchOptions: {
        headless: true,
        viewport: { width: 1280, height: 720 },
      },
    }),
    selfHeal: true,
    domSettleTimeout: 2000,
    verbose: 0,
    disablePino: true,
  }
}

// Creates and initialises a single browser session to be shared across a suite of tests.
export async function createStagehand(
  config: Pick<
    RunConfig,
    | "env"
    | "geminiApiKey"
    | "modelName"
    | "heliconeApiKey"
    | "heliconeBaseUrl"
    | "browserbaseApiKey"
    | "browserbaseProjectId"
  >
): Promise<Stagehand> {
  const stagehand = new Stagehand(buildStagehandConfig(config) as any)
  await stagehand.init()
  return stagehand
}

export async function retryAct(
  stagehand: Stagehand,
  instruction: string,
  options?: { variables?: Record<string, string> },
  maxAttempts = 3
): Promise<StepActResult> {
  let lastErr: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const raw = (await stagehand.act(instruction, options)) as any
      return {
        success: raw.success,
        message: raw.message,
        cacheStatus: raw.cacheStatus,
        actions: raw.actions?.length ? raw.actions : undefined,
      }
    } catch (err) {
      lastErr = err
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
      }
    }
  }
  throw lastErr
}

// Stagehand v3 is CDP-based (not Playwright). Network events require enabling the
// Network domain on each page's CDP session and listening via the underlying session.
// Console events use Stagehand's official page.on('console', ...) API.
// Returns a function that attaches listeners to any pages not yet instrumented.
// Call it before each step to pick up pages opened mid-test.
async function attachBrowserEventListeners(
  context: Stagehand["context"],
  network: StoredNetworkEntry[],
  console_: StoredConsoleEntry[]
): Promise<() => Promise<void>> {
  const listeningPages = new Set<object>()

  const kindMap: Record<string, StoredConsoleEntry["kind"]> = {
    log: "log",
    info: "info",
    warn: "warn",
    error: "error",
    debug: "log",
    verbose: "log",
    warning: "warn",
  }

  async function setupPage(page: any): Promise<void> {
    if (listeningPages.has(page)) return
    listeningPages.add(page)

    // reqMeta is per-page: CDP requestIds are scoped to a CDP session, not global
    const reqMeta = new Map<
      string,
      {
        startTime: number
        method: string
        url: string
        requestHeaders?: Record<string, string>
        requestBody?: string
      }
    >()

    // Console via Stagehand's official API
    page.on("console", (msg: any) => {
      try {
        console_.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          timestamp: msg.timestamp?.() ?? Date.now(),
          kind: kindMap[msg.type?.() ?? ""] ?? "log",
          message: msg.text?.() ?? "",
        })
      } catch {
        /* non-fatal */
      }
    })

    // Enable Network CDP domain then listen on the underlying CDP session
    await page.sendCDP("Network.enable", {})
    const session: any = (page as any).mainSession
    if (!session?.on) {
      console.error(
        "[iris-agent] Network.enable sent but mainSession has no .on — network capture unavailable for this page"
      )
      return
    }

    session.on("Network.requestWillBeSent", (params: any) => {
      const url: string = params.request?.url ?? ""
      if (!url || url.startsWith("data:") || url.startsWith("blob:")) return
      reqMeta.set(params.requestId, {
        startTime: Date.now(),
        method: params.request?.method ?? "GET",
        url,
        requestHeaders: params.request?.headers,
        requestBody: params.request?.postData,
      })
    })

    session.on("Network.responseReceived", (params: any) => {
      const url: string = params.response?.url ?? ""
      if (!url || url.startsWith("data:") || url.startsWith("blob:")) return
      const meta = reqMeta.get(params.requestId)
      const contentType: string =
        params.response?.headers?.["content-type"] ?? ""
      network.push({
        id: params.requestId,
        timestamp: meta?.startTime ?? Date.now(),
        method: meta?.method ?? "GET",
        url,
        status: params.response?.status ?? 0,
        mimeType: (contentType.split(";")[0] ?? "").trim(),
        duration: Date.now() - (meta?.startTime ?? Date.now()),
        requestHeaders: meta?.requestHeaders,
        responseHeaders: params.response?.headers,
        requestBody: meta?.requestBody,
      })
      reqMeta.delete(params.requestId)
    })

    // Clean up entries for requests that never received a response (aborted/timed-out)
    session.on("Network.loadingFailed", (params: any) => {
      reqMeta.delete(params.requestId)
    })
  }

  async function attachToNewPages(): Promise<void> {
    for (const page of context.pages()) {
      await setupPage(page).catch((e) => {
        console.error("[iris-agent] setupPage failed:", e)
      })
    }
  }

  await attachToNewPages()
  return attachToNewPages
}

// Runs a test's steps.
// When `sharedStagehand` is provided the browser is reused (session/cookies preserved)
// and is NOT closed on completion — the caller owns it.
export async function runTest(
  config: RunConfig,
  sharedStagehand?: Stagehand
): Promise<RunResult> {
  const startedAt = Date.now()
  const stepLogs: StepLog[] = []

  if (config.steps.length === 0) {
    return {
      runId: config.runId,
      status: "FAILED",
      stepLogs: [],
      metrics: {
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        reasoningTokens: 0,
        cachedTokens: 0,
        inferenceTimeMs: 0,
        cacheHits: 0,
        cacheMisses: 0,
      },
      errorMessage: "Test has no steps",
      totalDurationMs: 0,
    }
  }

  const ownsStagehand = !sharedStagehand
  const stagehand: Stagehand =
    sharedStagehand ??
    (() => {
      return new Stagehand(buildStagehandConfig(config) as any)
    })()

  if (ownsStagehand) await stagehand.init()

  const capturedNetwork: StoredNetworkEntry[] = []
  const capturedConsole: StoredConsoleEntry[] = []
  const attachToNewPages = await attachBrowserEventListeners(
    stagehand.context,
    capturedNetwork,
    capturedConsole
  )

  let liveViewUrl: string | undefined
  if (config.env === "BROWSERBASE") {
    liveViewUrl = stagehand.browserbaseDebugURL ?? undefined
  } else {
    liveViewUrl = `ws://localhost:${process.env.API_PORT ?? 3000}/sessions/${config.runId}/stream`
  }

  let screenshotInterval: ReturnType<typeof setInterval> | undefined
  if (config.env === "LOCAL" && config.onFrame) {
    let frameInFlight = false
    screenshotInterval = setInterval(async () => {
      if (frameInFlight) return
      frameInFlight = true
      try {
        const page = stagehand.context.activePage()
        if (page) {
          const buf = await page.screenshot({
            type: "jpeg",
            quality: 40,
          } as any)
          await config.onFrame!(buf.toString("base64"))
        }
      } catch {
        // Non-fatal — page may not be ready
      } finally {
        frameInFlight = false
      }
    }, 250)
  }

  const stopScreencast = () => {
    if (screenshotInterval) {
      clearInterval(screenshotInterval)
      screenshotInterval = undefined
    }
  }

  const closeIfOwned = async () => {
    if (ownsStagehand) await stagehand.close()
  }

  const captureScreenshot = async (): Promise<string | undefined> => {
    try {
      const p = stagehand.context.activePage() ?? stagehand.context.pages()[0]
      if (!p) return undefined
      const buf = await p.screenshot({ type: "jpeg", quality: 80 } as any)
      return buf.toString("base64")
    } catch {
      return undefined
    }
  }

  try {
    const page = stagehand.context.activePage() ?? stagehand.context.pages()[0]
    if (!page) throw new Error("No browser page available after init")
    await page.goto(config.startUrl, { waitUntil: "domcontentloaded" })

    const steps = [...config.steps].sort((a, b) => a.stepIndex - b.stepIndex)

    let firstFailure: string | undefined

    for (const step of steps) {
      // Pick up any pages opened since the last step (e.g. target="_blank" links)
      await attachToNewPages()

      const stepStart = Date.now()
      let actResult: StepActResult

      try {
        if (typeof step.instruction !== "string" || !step.instruction.trim()) {
          throw new Error(
            `Step ${step.stepIndex}: instruction must be a non-empty string, got: ${JSON.stringify(step.instruction)}`
          )
        }
        const resolvedInstruction = config.projectVariables
          ? interpolate(step.instruction, config.projectVariables)
          : step.instruction
        actResult = await executeStep(stagehand, resolvedInstruction, {
          ...(step.variables && { variables: step.variables }),
        })
      } catch (err) {
        const rawSnap = await safeGetMetrics(stagehand)
        const log: StepLog = {
          stepIndex: step.stepIndex,
          testStepId: step.id,
          instruction: step.instruction,
          description: step.description,
          result: "FAILED",
          durationMs: Date.now() - stepStart,
          errorMessage: String(err),
          screenshotBase64: await captureScreenshot(),
          metricsSnapshot: rawSnap ? toSnapshot(rawSnap) : undefined,
        }
        stepLogs.push(log)
        await config.onStepComplete?.(log)
        if (!config.continueOnFailure) {
          stopScreencast()
          await closeIfOwned()
          return {
            runId: config.runId,
            status: "FAILED",
            stepLogs,
            metrics: buildMetrics(stepLogs, rawSnap),
            liveViewUrl,
            errorMessage: `Step ${step.stepIndex + 1} failed: ${String(err)}`,
            totalDurationMs: Date.now() - startedAt,
            browserEvents: {
              network: capturedNetwork,
              console: capturedConsole,
            },
          }
        }
        firstFailure ??= `Step ${step.stepIndex + 1} failed: ${String(err)}`
        continue
      }

      const rawSnap = await safeGetMetrics(stagehand)
      const log: StepLog = {
        stepIndex: step.stepIndex,
        testStepId: step.id,
        instruction: step.instruction,
        description: step.description,
        result: actResult.success ? "PASSED" : "FAILED",
        cacheStatus: actResult.cacheStatus,
        durationMs: Date.now() - stepStart,
        errorMessage: actResult.success ? undefined : actResult.message,
        screenshotBase64: await captureScreenshot(),
        actions: actResult.actions?.length ? actResult.actions : undefined,
        metricsSnapshot: rawSnap ? toSnapshot(rawSnap) : undefined,
      }

      stepLogs.push(log)
      await config.onStepComplete?.(log)

      if (!actResult.success) {
        if (!config.continueOnFailure) {
          stopScreencast()
          await closeIfOwned()
          return {
            runId: config.runId,
            status: "FAILED",
            stepLogs,
            metrics: buildMetrics(stepLogs, rawSnap),
            liveViewUrl,
            errorMessage: `Step ${step.stepIndex + 1} failed: ${actResult.message}`,
            totalDurationMs: Date.now() - startedAt,
            browserEvents: {
              network: capturedNetwork,
              console: capturedConsole,
            },
          }
        }
        firstFailure ??= `Step ${step.stepIndex + 1} failed: ${actResult.message}`
      }
    }

    stopScreencast()
    const rawMetrics = await safeGetMetrics(stagehand)
    await closeIfOwned()

    return {
      runId: config.runId,
      status: firstFailure ? "FAILED" : "PASSED",
      stepLogs,
      metrics: buildMetrics(stepLogs, rawMetrics),
      liveViewUrl,
      errorMessage: firstFailure,
      totalDurationMs: Date.now() - startedAt,
      browserEvents: { network: capturedNetwork, console: capturedConsole },
    }
  } catch (err) {
    stopScreencast()
    if (ownsStagehand) await stagehand.close().catch(() => {})
    return {
      runId: config.runId,
      status: "FAILED",
      stepLogs,
      metrics: {
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        reasoningTokens: 0,
        cachedTokens: 0,
        inferenceTimeMs: 0,
        cacheHits: 0,
        cacheMisses: 0,
      },
      liveViewUrl,
      errorMessage: String(err),
      totalDurationMs: Date.now() - startedAt,
      browserEvents: { network: capturedNetwork, console: capturedConsole },
    }
  }
}

async function safeGetMetrics(stagehand: Stagehand): Promise<any> {
  try {
    return await stagehand.metrics
  } catch {
    return null
  }
}

function toSnapshot(raw: any): MetricsSnapshot {
  return {
    totalPromptTokens: raw?.totalPromptTokens ?? 0,
    totalCompletionTokens: raw?.totalCompletionTokens ?? 0,
    totalReasoningTokens: raw?.totalReasoningTokens ?? 0,
    totalCachedInputTokens: raw?.totalCachedInputTokens ?? 0,
    totalInferenceTimeMs: raw?.totalInferenceTimeMs ?? 0,
  }
}

function buildMetrics(stepLogs: StepLog[], rawMetrics: any): RunMetrics {
  const promptTokens = rawMetrics?.totalPromptTokens ?? 0
  const completionTokens = rawMetrics?.totalCompletionTokens ?? 0
  const reasoningTokens = rawMetrics?.totalReasoningTokens ?? 0
  const cachedTokens = rawMetrics?.totalCachedInputTokens ?? 0
  return {
    totalTokens: promptTokens + completionTokens,
    promptTokens,
    completionTokens,
    reasoningTokens,
    cachedTokens,
    inferenceTimeMs: rawMetrics?.totalInferenceTimeMs ?? 0,
    cacheHits: stepLogs.filter((s) => s.cacheStatus === "HIT").length,
    cacheMisses: stepLogs.filter((s) => s.cacheStatus === "MISS").length,
  }
}
