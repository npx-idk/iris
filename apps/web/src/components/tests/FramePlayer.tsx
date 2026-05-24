'use client'

import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { HugeiconsIcon } from '@hugeicons/react'
import { PlayIcon, PauseIcon, Refresh01Icon } from '@hugeicons/core-free-icons'
import { Button } from '@workspace/ui/components/button'

interface FramePlayerProps {
  runId: string
  className?: string
}

const FPS = 4

export function FramePlayer({ runId, className }: FramePlayerProps) {
  const [frames, setFrames] = useState<string[]>([])
  const [current, setCurrent] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setLoading(true)
    api.get<string[]>(`/runs/${runId}/frames`).then((f) => {
      setFrames(f)
      setCurrent(0)
      setPlaying(false)
    }).finally(() => setLoading(false))
  }, [runId])

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (!playing || frames.length === 0) return
    intervalRef.current = setInterval(() => {
      setCurrent((prev) => {
        if (prev >= frames.length - 1) { setPlaying(false); return prev }
        return prev + 1
      })
    }, 1000 / FPS)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [playing, frames.length])

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-black rounded-xl ${className ?? 'aspect-video w-full'}`}>
        <span className="text-xs text-muted-foreground">Loading recording…</span>
      </div>
    )
  }

  if (frames.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-black rounded-xl ${className ?? 'aspect-video w-full'}`}>
        <span className="text-xs text-muted-foreground">No recording available</span>
      </div>
    )
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'

  return (
    <div className={`flex flex-col gap-2 ${className ?? ''}`}>
      <div className="relative rounded-xl overflow-hidden bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={frames[current]!.startsWith('http') ? frames[current] : `${apiBase}${frames[current]}`}
          alt={`Frame ${current + 1}`}
          className="w-full aspect-video object-contain"
        />
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-md px-2 py-1">
          <span className="text-xs text-white/70 tabular-nums">
            {current + 1} / {frames.length}
          </span>
        </div>
      </div>

      {/* Scrubber */}
      <input
        type="range"
        min={0}
        max={frames.length - 1}
        value={current}
        onChange={(e) => { setPlaying(false); setCurrent(Number(e.target.value)) }}
        className="w-full accent-primary h-1 rounded"
      />

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
          <HugeiconsIcon icon={playing ? PauseIcon : PlayIcon} size={12} color="currentColor" strokeWidth={1.5} />
          {playing ? 'Pause' : 'Play'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setPlaying(false); setCurrent(0) }}
        >
          <HugeiconsIcon icon={Refresh01Icon} size={12} color="currentColor" strokeWidth={1.5} />
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          {(frames.length / FPS).toFixed(0)}s recording · {frames.length} frames
        </span>
      </div>
    </div>
  )
}
