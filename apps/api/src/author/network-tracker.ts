import type { BrowserEvent } from "@iris/common"

type ReqMeta = {
  method: string
  url: string
  headers: Record<string, string>
  postData?: string
  startTime: number
}

/**
 * Tracks XHR/fetch traffic on one CDP session and reports request/response
 * pairs (plus bodies) as BrowserEvents for the authoring devtools panel.
 */
export class NetworkTracker {
  constructor(
    private readonly sessionId: string,
    private readonly onEvent: (event: BrowserEvent) => void
  ) {}

  attach(cdpSession: any, p: any): void {
    const reqData = new Map<string, ReqMeta>()

    cdpSession.on("Network.requestWillBeSent", (evt: any) => {
      if (!evt?.requestId) return
      if (reqData.size > 500) {
        const oldest = reqData.keys().next().value
        if (oldest) reqData.delete(oldest)
      }
      reqData.set(evt.requestId, {
        method: evt.request?.method ?? "GET",
        url: evt.request?.url ?? "",
        headers: evt.request?.headers ?? {},
        postData: evt.request?.postData,
        startTime: Date.now(),
      })
    })

    cdpSession.on("Network.responseReceived", (evt: any) => {
      const type = (evt?.type ?? "").toLowerCase()
      const req = reqData.get(evt?.requestId)
      if (!req) return
      if (!["xhr", "fetch"].includes(type)) {
        reqData.delete(evt.requestId)
        return
      }
      this.onEvent({
        sessionId: this.sessionId,
        kind: "network.response",
        requestId: evt.requestId,
        method: req.method,
        url: req.url,
        requestHeaders: req.headers,
        requestBody: req.postData,
        status: evt.response?.status,
        responseHeaders: evt.response?.headers,
        mimeType: evt.response?.mimeType,
        timestamp: Date.now(),
      })
    })

    cdpSession.on("Network.loadingFinished", async (evt: any) => {
      const req = reqData.get(evt?.requestId)
      if (!req) return
      const duration = Date.now() - req.startTime
      reqData.delete(evt.requestId)

      let body = ""
      let base64Encoded = false
      try {
        const r = (await p.sendCDP("Network.getResponseBody", {
          requestId: evt.requestId,
        })) as any
        body = typeof r.body === "string" ? r.body.slice(0, 50_000) : ""
        base64Encoded = r.base64Encoded ?? false
      } catch {
        /* body unavailable */
      }

      this.onEvent({
        sessionId: this.sessionId,
        kind: "network.body",
        requestId: evt.requestId,
        body,
        base64Encoded,
        duration,
        timestamp: Date.now(),
      })
    })

    cdpSession.on("Network.loadingFailed", (evt: any) => {
      reqData.delete(evt?.requestId)
    })
  }
}
