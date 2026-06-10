"use client"

import { useState } from "react"
import type { NetworkEntry } from "@/components/tests/NetworkPanel"
import type { ConsoleEntry } from "@/components/tests/ConsolePanel"

export function useBrowserDevtools() {
  const [networkEntries, setNetworkEntries] = useState<NetworkEntry[]>([])
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([])

  function handleBrowserEvent(e: Record<string, unknown>) {
    if (e.kind === "network.response") {
      setNetworkEntries((prev) =>
        [
          {
            id: e.requestId as string,
            timestamp: e.timestamp as number,
            method: e.method as string,
            url: e.url as string,
            requestHeaders: e.requestHeaders as Record<string, string>,
            requestBody: e.requestBody as string | undefined,
            status: e.status as number,
            responseHeaders: e.responseHeaders as Record<string, string>,
            mimeType: e.mimeType as string,
            pending: true,
          },
          ...prev,
        ].slice(0, 500)
      )
    } else if (e.kind === "network.body") {
      setNetworkEntries((prev) =>
        prev.map((n) =>
          n.id === e.requestId
            ? {
                ...n,
                responseBody: e.base64Encoded ? "[binary]" : (e.body as string),
                duration: e.duration as number,
                pending: false,
              }
            : n
        )
      )
    } else {
      const entry: ConsoleEntry = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: (e.timestamp as number) ?? Date.now(),
        kind:
          e.kind === "console"
            ? ((e.level as ConsoleEntry["kind"]) ?? "log")
            : (e.kind as ConsoleEntry["kind"]),
        message:
          e.kind === "navigation"
            ? (e.message as string)
            : ((e.message as string) ?? ""),
      }
      setConsoleEntries((prev) => [...prev, entry].slice(-500))
    }
  }

  return {
    networkEntries,
    consoleEntries,
    handleBrowserEvent,
    clearNetwork: () => setNetworkEntries([]),
    clearConsole: () => setConsoleEntries([]),
  }
}
