"use client"

import { runStatusDot } from "@/lib/run-status"
import type { RunStatus } from "@/lib/types"

export function StatusDot({ status }: { status?: RunStatus }) {
  return (
    <div
      className={`size-2 shrink-0 rounded-full ${status ? runStatusDot[status] : "bg-muted/60"}`}
    />
  )
}
