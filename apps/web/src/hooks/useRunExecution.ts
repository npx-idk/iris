"use client"

import { useState, useEffect, RefObject } from "react"
import { createSessionSocket } from "@/lib/socket"
import { api } from "@/lib/api"
import { RunStatus, TestRun, TestRunStep } from "@/lib/types"

export function useRunExecution(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  refetch: () => void
) {
  const [runMode, setRunMode] = useState(false)
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [runStatus, setRunStatus] = useState<RunStatus | null>(null)
  const [runSteps, setRunSteps] = useState<TestRunStep[]>([])
  const [runError, setRunError] = useState<string | null>(null)
  const [runFinishedAt, setRunFinishedAt] = useState<number | null>(null)

  useEffect(() => {
    if (!activeRunId || !runMode) return
    const socket = createSessionSocket(activeRunId)
    socket.on("frame", ({ frameBase64 }: { frameBase64: string }) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      const img = new Image()
      img.onload = () => ctx?.drawImage(img, 0, 0, canvas.width, canvas.height)
      img.src = `data:image/jpeg;base64,${frameBase64}`
    })
    socket.on("event", (e: any) => {
      if (e.type === "run.started") setRunStatus("RUNNING")
      if (e.type === "step.completed") {
        setRunSteps((prev) => [...prev, e.step])
      }
      if (e.type === "run.completed") {
        api.get<TestRun>(`/runs/${activeRunId}`).then((data) => {
          setRunStatus(data.status)
          setRunSteps(data.stepResults ?? [])
          setRunError(data.errorMessage ?? null)
          setRunFinishedAt(Date.now())
          refetch()
          // Return to authoring after refetch settles so lastRunStepMap takes over border stripes
          setTimeout(() => {
            setRunMode(false)
            setActiveRunId(null)
          }, 2000)
        })
        socket.disconnect()
      }
    })
    return () => {
      socket.disconnect()
    }
  }, [activeRunId, runMode]) // eslint-disable-line react-hooks/exhaustive-deps

  function startRun(runId: string) {
    setActiveRunId(runId)
    setRunStatus("QUEUED")
    setRunSteps([])
    setRunError(null)
    setRunFinishedAt(null)
    setRunMode(true)
  }

  function exitRunMode() {
    setRunMode(false)
    setActiveRunId(null)
    setRunStatus(null)
    setRunSteps([])
    setRunError(null)
  }

  return {
    runMode,
    activeRunId,
    runStatus,
    runSteps,
    runError,
    runFinishedAt,
    startRun,
    exitRunMode,
  }
}
