import { ConflictException, NotFoundException } from '@nestjs/common'
import { createStagehand } from '@iris/agent'
import type { BrowserTab, BrowserEvent } from '@iris/common'
import { DispatchInputDto } from './dto/dispatch-input.dto'

type StagehandSession = Awaited<ReturnType<typeof createStagehand>>

type ReqMeta = { method: string; url: string; headers: Record<string, string>; postData?: string; startTime: number }

export class BrowserSession {
  readonly id: string
  readonly testId: string
  readonly userId: string
  busy = false

  private stagehand: StagehandSession
  private listenedTargets = new Set<string>()
  private screenshotTimer: ReturnType<typeof setInterval> | undefined
  private onEvent: (event: BrowserEvent) => void

  constructor(
    id: string,
    testId: string,
    userId: string,
    stagehand: StagehandSession,
    onEvent: (event: BrowserEvent) => void,
  ) {
    this.id = id
    this.testId = testId
    this.userId = userId
    this.stagehand = stagehand
    this.onEvent = onEvent
  }

  async attachPage(p: any): Promise<void> {
    const tId: string | undefined = p.targetId?.()
    if (tId && this.listenedTargets.has(tId)) return
    if (tId) this.listenedTargets.add(tId)

    try {
      p.on('console', (msg: any) => {
        const level = msg.type() as string
        if (level === 'debug') return
        this.onEvent({ sessionId: this.id, kind: 'console', level, message: msg.text(), timestamp: Date.now() })
      })
    } catch { /* ignore */ }

    const cdpSession = p.mainSession
    if (!cdpSession) return

    // Fire-and-forget: awaiting Network.enable blocks all subsequent CDP commands
    // for this session in Chrome's per-session queue, causing input events to hang.
    void p.sendCDP('Network.enable').catch(() => {})

    cdpSession.on('Runtime.exceptionThrown', (evt: any) => {
      const msg = evt?.exceptionDetails?.exception?.description
        ?? evt?.exceptionDetails?.text ?? 'Unknown error'
      this.onEvent({ sessionId: this.id, kind: 'exception', message: msg, timestamp: Date.now() })
    })

    cdpSession.on('Page.frameNavigated', (evt: any) => {
      if (evt?.frame?.parentId) return
      const url = evt?.frame?.url
      if (!url || url === 'about:blank') return
      this.onEvent({ sessionId: this.id, kind: 'navigation', message: url, timestamp: Date.now() })
    })

    const reqData = new Map<string, ReqMeta>()

    cdpSession.on('Network.requestWillBeSent', (evt: any) => {
      if (!evt?.requestId) return
      if (reqData.size > 500) {
        const oldest = reqData.keys().next().value
        if (oldest) reqData.delete(oldest)
      }
      reqData.set(evt.requestId, {
        method: evt.request?.method ?? 'GET',
        url: evt.request?.url ?? '',
        headers: evt.request?.headers ?? {},
        postData: evt.request?.postData,
        startTime: Date.now(),
      })
    })

    cdpSession.on('Network.responseReceived', (evt: any) => {
      const type = (evt?.type ?? '').toLowerCase()
      const req = reqData.get(evt?.requestId)
      if (!req) return
      if (!['xhr', 'fetch'].includes(type)) { reqData.delete(evt.requestId); return }
      this.onEvent({
        sessionId: this.id,
        kind: 'network.response',
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

    cdpSession.on('Network.loadingFinished', async (evt: any) => {
      const req = reqData.get(evt?.requestId)
      if (!req) return
      const duration = Date.now() - req.startTime
      reqData.delete(evt.requestId)

      let body = ''
      let base64Encoded = false
      try {
        const r = await p.sendCDP('Network.getResponseBody', { requestId: evt.requestId }) as any
        body = typeof r.body === 'string' ? r.body.slice(0, 50_000) : ''
        base64Encoded = r.base64Encoded ?? false
      } catch { /* body unavailable */ }

      this.onEvent({ sessionId: this.id, kind: 'network.body', requestId: evt.requestId, body, base64Encoded, duration, timestamp: Date.now() })
    })

    cdpSession.on('Network.loadingFailed', (evt: any) => { reqData.delete(evt?.requestId) })
  }

  startScreencast(onFrame: (frameBase64: string) => void, onNewTab: () => void): void {
    let frameInFlight = false
    this.screenshotTimer = setInterval(async () => {
      if (frameInFlight) return
      frameInFlight = true
      try {
        // Auto-detect tabs opened by the browser (window.open, target="_blank", etc.)
        let newTabDetected = false
        for (const pg of this.stagehand.context.pages()) {
          if (!this.listenedTargets.has(pg.targetId())) {
            void this.attachPage(pg as any)
            newTabDetected = true
          }
        }
        if (newTabDetected) onNewTab()

        const p = this.stagehand.context.activePage()
        if (p) {
          const buf = await p.screenshot({ type: 'jpeg', quality: 40 } as any)
          onFrame(buf.toString('base64'))
        }
      } catch { /* page may not be ready */ }
      finally { frameInFlight = false }
    }, 250)
  }

  stopScreencast(): void {
    if (this.screenshotTimer) {
      clearInterval(this.screenshotTimer)
      this.screenshotTimer = undefined
    }
  }

  getActivePage(): any {
    return this.stagehand.context.activePage()
  }

  getTabs(): BrowserTab[] {
    const pages = this.stagehand.context.pages()
    const activeTargetId = this.stagehand.context.activePage()?.targetId()
    return pages.map((p) => ({
      targetId: p.targetId(),
      url: p.url(),
      active: p.targetId() === activeTargetId,
    }))
  }

  async navigate(url: string): Promise<void> {
    const page = this.stagehand.context.activePage()
    if (!page) return
    let target = url.trim()
    if (target && !/^https?:\/\//i.test(target) && !target.startsWith('about:')) {
      target = `https://${target}`
    }
    await page.goto(target, { waitUntil: 'domcontentloaded', timeoutMs: 8000 }).catch(() => {})
  }

  async goBack(): Promise<void> {
    const page = this.stagehand.context.activePage()
    if (!page) return
    await page.goBack({ waitUntil: 'domcontentloaded', timeoutMs: 8000 }).catch(() => {})
  }

  async goForward(): Promise<void> {
    const page = this.stagehand.context.activePage()
    if (!page) return
    await page.goForward({ waitUntil: 'domcontentloaded', timeoutMs: 8000 }).catch(() => {})
  }

  async reload(): Promise<void> {
    const page = this.stagehand.context.activePage()
    if (!page) return
    await page.reload({ waitUntil: 'domcontentloaded', timeoutMs: 8000 }).catch(() => {})
  }

  async dispatchInput(dto: DispatchInputDto): Promise<void> {
    const page = this.stagehand.context.activePage()
    if (!page) return

    const mouseTypes = ['mousePressed', 'mouseReleased', 'mouseMoved', 'mouseWheel']
    const keyTypes   = ['keyDown', 'keyUp', 'char']

    if (mouseTypes.includes(dto.type)) {
      await page.sendCDP('Input.dispatchMouseEvent', {
        type: dto.type,
        x: dto.x ?? 0,
        y: dto.y ?? 0,
        button: dto.button ?? 'none',
        clickCount: dto.clickCount ?? 0,
        deltaX: dto.deltaX ?? 0,
        deltaY: dto.deltaY ?? 0,
        modifiers: dto.modifiers ?? 0,
      })
    } else if (keyTypes.includes(dto.type)) {
      await page.sendCDP('Input.dispatchKeyEvent', {
        type: dto.type,
        key: dto.key ?? '',
        text: dto.text ?? '',
        code: dto.code ?? '',
        modifiers: dto.modifiers ?? 0,
        windowsVirtualKeyCode: dto.windowsVirtualKeyCode ?? 0,
        nativeVirtualKeyCode: dto.windowsVirtualKeyCode ?? 0,
      })
    }
  }

  async getApplicationData(): Promise<{
    cookies: any[]
    localStorage: Record<string, string>
    sessionStorage: Record<string, string>
  }> {
    const page = this.stagehand.context.activePage()
    if (!page) return { cookies: [], localStorage: {}, sessionStorage: {} }

    const evalStorage = (type: 'localStorage' | 'sessionStorage') =>
      `(()=>{try{const s=window.${type},d={};for(let i=0;i<s.length;i++){const k=s.key(i);d[k]=s.getItem(k)}return JSON.stringify(d)}catch{return '{}'}})()`

    const [cookiesR, localR, sessionR] = await Promise.allSettled([
      page.sendCDP('Network.getCookies'),
      page.sendCDP('Runtime.evaluate', { expression: evalStorage('localStorage'), returnByValue: true }),
      page.sendCDP('Runtime.evaluate', { expression: evalStorage('sessionStorage'), returnByValue: true }),
    ])

    const cookies = cookiesR.status === 'fulfilled' ? (cookiesR.value as any).cookies ?? [] : []
    let localStorage: Record<string, string> = {}
    let sessionStorage: Record<string, string> = {}
    try { if (localR.status === 'fulfilled') localStorage = JSON.parse((localR.value as any).result?.value ?? '{}') } catch {}
    try { if (sessionR.status === 'fulfilled') sessionStorage = JSON.parse((sessionR.value as any).result?.value ?? '{}') } catch {}

    return { cookies, localStorage, sessionStorage }
  }

  async getDevtoolsUrl(): Promise<{ url: string } | null> {
    const page = this.stagehand.context.activePage()
    if (!page) return null

    const wsUrl = (this.stagehand.context.conn as any)?.ws?.url as string | undefined
    if (!wsUrl) return null

    const portMatch = wsUrl.match(/:(\d+)\//)
    if (!portMatch) return null
    const port = portMatch[1]
    const targetId = page.targetId()

    try {
      // Raw fetch is intentional here: this hits the local Chrome debug HTTP endpoint,
      // not an external API, so using Axios would add unnecessary overhead.
      const resp = await fetch(`http://127.0.0.1:${port}/json/list`)
      const targets = await resp.json() as Array<{ id: string; devtoolsFrontendUrl?: string }>
      const target = targets.find((t) => t.id === targetId)
      if (target?.devtoolsFrontendUrl) {
        const frontendUrl = target.devtoolsFrontendUrl
        const url = frontendUrl.startsWith('http') ? frontendUrl : `http://127.0.0.1:${port}${frontendUrl}`
        return { url }
      }
    } catch { /* fall through */ }

    return { url: `http://127.0.0.1:${port}/devtools/inspector.html?ws=127.0.0.1:${port}/devtools/page/${targetId}` }
  }

  async newTab(url?: string): Promise<{ targetId: string }> {
    const newPage = await this.stagehand.context.newPage(url ?? 'about:blank')
    void this.attachPage(newPage as any)
    this.stagehand.context.setActivePage(newPage)
    return { targetId: newPage.targetId() }
  }

  activateTab(targetId: string): void {
    const page = this.stagehand.context.pages().find((p) => p.targetId() === targetId)
    if (!page) throw new NotFoundException('Tab not found')
    this.stagehand.context.setActivePage(page)
  }

  async closeTab(targetId: string): Promise<void> {
    const pages = this.stagehand.context.pages()
    if (pages.length <= 1) throw new ConflictException('Cannot close the last tab')

    const page = pages.find((p) => p.targetId() === targetId)
    if (!page) throw new NotFoundException('Tab not found')

    const activePage = this.stagehand.context.activePage()
    if (activePage?.targetId() === targetId) {
      const other = pages.find((p) => p.targetId() !== targetId)
      if (other) this.stagehand.context.setActivePage(other)
    }

    this.listenedTargets.delete(targetId)
    await page.close().catch(() => {})
  }

  async gotoUrl(url: string): Promise<void> {
    const page = this.stagehand.context.activePage() ?? this.stagehand.context.pages()[0]
    await page?.goto(url, { waitUntil: 'domcontentloaded', timeoutMs: 15000 }).catch(() => {})
  }

  get stagehandInstance(): StagehandSession {
    return this.stagehand
  }

  async close(): Promise<void> {
    this.stopScreencast()
    await this.stagehand.close().catch(() => {})
  }
}
