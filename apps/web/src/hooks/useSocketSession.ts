"use client"

import { useEffect } from "react"
import { createSessionSocket } from "@/lib/socket"
import { BrowserTab } from "@/lib/types"

interface SocketSessionCallbacks {
  onFrame: (frameBase64: string) => void
  onAuthorReady: () => void
  onStepStarted: (pos: number) => void
  onStepCompleted: (pos: number, passed: boolean) => void
  onTabsUpdate: (tabs: BrowserTab[], urlFocused: boolean) => void
  onBrowserEvent: (event: Record<string, unknown>) => void
}

export function useSocketSession(
  sessionId: string | null,
  callbacks: SocketSessionCallbacks
) {
  useEffect(() => {
    if (!sessionId) return
    const socket = createSessionSocket(sessionId)

    socket.on("frame", ({ frameBase64 }: { frameBase64: string }) => {
      callbacks.onFrame(frameBase64)
    })

    socket.on("event", (e: any) => {
      if (e.type === "author.ready") callbacks.onAuthorReady()
      if (e.type === "author.step.started") callbacks.onStepStarted(e.pos)
      if (e.type === "author.step.completed")
        callbacks.onStepCompleted(e.pos, e.passed)
      if (e.type === "author.tabs") callbacks.onTabsUpdate(e.tabs ?? [], false)
      if (e.type === "author.browser") callbacks.onBrowserEvent(e)
    })

    return () => {
      socket.disconnect()
    }
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps
}
