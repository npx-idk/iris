"use client"

import { useEffect, useRef, useState } from "react"
import { api } from "@/lib/api"
import { HugeiconsIcon } from "@hugeicons/react"
import { PlayIcon, PauseIcon, Refresh01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@iris/ui/components/animate-ui/components/buttons/button"

interface FramePlayerProps {
  /** Run to fetch frames for; not needed when `frames` is supplied. */
  runId?: string
  /** Preloaded frame URLs (e.g. from the public share endpoint); skips the internal fetch. */
  frames?: string[]
  className?: string
  viewportWidth?: number
  viewportHeight?: number
}

const FPS = 4

export function FramePlayer({
  runId,
  frames: framesProp,
  className,
  viewportWidth,
  viewportHeight,
}: FramePlayerProps) {
  const [fetchedFrames, setFetchedFrames] = useState<string[]>([])
  const [current, setCurrent] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(framesProp == null)
  const frames = framesProp ?? fetchedFrames
  // Frame aspect ratio (w/h) shapes the mock browser window so phone
  // recordings get a phone-sized window. Seeded from the test's viewport,
  // refined from the actual frame dimensions once one loads (old recordings
  // may have been captured at a different size than the current setting).
  const [aspect, setAspect] = useState<number | null>(null)
  const fallbackAspect =
    viewportWidth && viewportHeight ? viewportWidth / viewportHeight : 16 / 9
  const effectiveAspect = aspect ?? fallbackAspect
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Cached images can be complete before React attaches onLoad, so measure
  // from the ref callback as well.
  function captureAspect(img: HTMLImageElement | null) {
    if (img?.complete && img.naturalWidth && img.naturalHeight) {
      const a = img.naturalWidth / img.naturalHeight
      setAspect((prev) => (prev === a ? prev : a))
    }
  }

  const hasFramesProp = framesProp != null
  useEffect(() => {
    if (hasFramesProp || !runId) return
    setLoading(true)
    api
      .get<string[]>(`/runs/${runId}/frames`)
      .then((f) => {
        setFetchedFrames(f)
        setCurrent(0)
        setPlaying(false)
      })
      .finally(() => setLoading(false))
  }, [runId, hasFramesProp])

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (!playing || frames.length === 0) return
    intervalRef.current = setInterval(() => {
      setCurrent((prev) => {
        if (prev >= frames.length - 1) {
          setPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, 1000 / FPS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [playing, frames.length])

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl bg-black ${className ?? "aspect-video w-full"}`}
      >
        <span className="text-xs text-muted-foreground">
          Loading recording…
        </span>
      </div>
    )
  }

  if (frames.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl bg-black ${className ?? "aspect-video w-full"}`}
      >
        <span className="text-xs text-muted-foreground">
          No recording available
        </span>
      </div>
    )
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"

  return (
    <div className={`flex flex-col gap-3 ${className ?? ""}`}>
      <div
        className="relative mx-auto flex w-full flex-col overflow-hidden rounded-xl border border-border bg-black shadow-xl"
        style={{
          maxWidth: `min(100%, calc(60vh * ${effectiveAspect.toFixed(4)}))`,
        }}
      >
        {/* Mock Browser Chrome */}
        <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-muted/80 px-4">
          <div className="h-2.5 w-2.5 rounded-full bg-destructive/80" />
          <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-primary/80" />
          <div className="flex min-w-0 flex-1 justify-center">
            <div className="flex h-5 w-full max-w-64 items-center justify-center truncate rounded-md bg-background/50 px-2 font-mono text-[10px] text-muted-foreground/50 select-none">
              recording playback
            </div>
          </div>
        </div>

        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              frames[current]!.startsWith("http")
                ? frames[current]
                : `${apiBase}${frames[current]}`
            }
            alt={`Frame ${current + 1}`}
            ref={captureAspect}
            onLoad={(e) => captureAspect(e.currentTarget)}
            className="h-auto w-full"
          />
          <div className="absolute right-2 bottom-2 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 backdrop-blur-sm">
            <span className="text-xs text-foreground/70 tabular-nums">
              {current + 1} / {frames.length}
            </span>
          </div>
        </div>
      </div>

      {/* Scrubber */}
      <div className="px-1">
        <input
          type="range"
          min={0}
          max={frames.length - 1}
          value={current}
          onChange={(e) => {
            setPlaying(false)
            setCurrent(Number(e.target.value))
          }}
          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-muted outline-none [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:bg-primary [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (current >= frames.length - 1) setCurrent(0)
            setPlaying((p) => !p)
          }}
          className="gap-1.5"
        >
          <HugeiconsIcon
            icon={playing ? PauseIcon : PlayIcon}
            size={12}
            color="currentColor"
            strokeWidth={1.5}
          />
          {playing ? "Pause" : "Play"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setPlaying(false)
            setCurrent(0)
          }}
        >
          <HugeiconsIcon
            icon={Refresh01Icon}
            size={12}
            color="currentColor"
            strokeWidth={1.5}
          />
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          {(frames.length / FPS).toFixed(0)}s recording · {frames.length} frames
        </span>
      </div>
    </div>
  )
}
