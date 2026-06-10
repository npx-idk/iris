import type { BrowserEvent } from "@iris/common"
import { NetworkTracker } from "./network-tracker"

/**
 * Attaches CDP/page listeners (console, exceptions, navigation, network) to
 * browser pages and forwards everything as BrowserEvents. Tracks which
 * targets are already wired so pages are only attached once.
 */
export class BrowserEventCapture {
  private listenedTargets = new Set<string>()
  private readonly network: NetworkTracker

  constructor(
    private readonly sessionId: string,
    private readonly onEvent: (event: BrowserEvent) => void
  ) {
    this.network = new NetworkTracker(sessionId, onEvent)
  }

  isAttached(targetId: string): boolean {
    return this.listenedTargets.has(targetId)
  }

  detach(targetId: string): void {
    this.listenedTargets.delete(targetId)
  }

  async attachPage(p: any): Promise<void> {
    const tId: string | undefined = p.targetId?.()
    if (tId && this.listenedTargets.has(tId)) return
    if (tId) this.listenedTargets.add(tId)

    this.setupConsoleListener(p)

    const cdpSession = p.mainSession
    if (!cdpSession) return

    // Fire-and-forget: awaiting Network.enable blocks all subsequent CDP commands
    // for this session in Chrome's per-session queue, causing input events to hang.
    void p.sendCDP("Network.enable").catch(() => {})

    this.setupExceptionListener(cdpSession)
    this.setupNavigationListener(cdpSession)
    this.network.attach(cdpSession, p)
  }

  private setupConsoleListener(p: any): void {
    try {
      p.on("console", (msg: any) => {
        const level = msg.type() as string
        if (level === "debug") return
        this.onEvent({
          sessionId: this.sessionId,
          kind: "console",
          level,
          message: msg.text(),
          timestamp: Date.now(),
        })
      })
    } catch {
      /* ignore */
    }
  }

  private setupExceptionListener(cdpSession: any): void {
    cdpSession.on("Runtime.exceptionThrown", (evt: any) => {
      const msg =
        evt?.exceptionDetails?.exception?.description ??
        evt?.exceptionDetails?.text ??
        "Unknown error"
      this.onEvent({
        sessionId: this.sessionId,
        kind: "exception",
        message: msg,
        timestamp: Date.now(),
      })
    })
  }

  private setupNavigationListener(cdpSession: any): void {
    cdpSession.on("Page.frameNavigated", (evt: any) => {
      if (evt?.frame?.parentId) return
      const url = evt?.frame?.url
      if (!url || url === "about:blank") return
      this.onEvent({
        sessionId: this.sessionId,
        kind: "navigation",
        message: url,
        timestamp: Date.now(),
      })
    })
  }
}
