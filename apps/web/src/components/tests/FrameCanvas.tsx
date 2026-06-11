"use client"

import { RefObject } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cursor01Icon } from "@hugeicons/core-free-icons"
import { SessionState } from "@/hooks/useAuthorSession"

export interface CanvasHandlers {
  onMouseDown: React.MouseEventHandler<HTMLCanvasElement>
  onMouseUp: React.MouseEventHandler<HTMLCanvasElement>
  onMouseMove: React.MouseEventHandler<HTMLCanvasElement>
  onMouseLeave: () => void
  onContextMenu: React.MouseEventHandler<HTMLCanvasElement>
  onKeyDown: React.KeyboardEventHandler<HTMLCanvasElement>
  onKeyUp: React.KeyboardEventHandler<HTMLCanvasElement>
}

/**
 * Live browser viewport: mock chrome + the frame canvas with interaction
 * overlays. Always mounted (collapses to h-0) so it keeps receiving frames.
 */
export function FrameCanvas({
  show,
  canvasRef,
  canvasHandlers,
  sessionState,
  runActive,
  interactiveMode,
  onInteractiveModeChange,
  isBusy,
  statusLabel,
  viewportWidth = 1280,
  viewportHeight = 720,
}: {
  show: boolean
  canvasRef: RefObject<HTMLCanvasElement | null>
  canvasHandlers: CanvasHandlers
  sessionState: SessionState
  runActive: boolean
  interactiveMode: boolean
  onInteractiveModeChange: (v: boolean) => void
  isBusy: boolean
  statusLabel: string
  viewportWidth?: number
  viewportHeight?: number
}) {
  // Shape the mock browser window to the test's viewport so phone sizes get
  // a phone-sized window instead of letterboxing inside a desktop frame.
  const aspect = viewportWidth / viewportHeight
  return (
    <div
      className={
        show
          ? "flex min-h-0 flex-1 items-center justify-center overflow-hidden p-6"
          : "h-0 overflow-hidden"
      }
    >
      <div
        className="w-full space-y-3"
        style={{ maxWidth: `min(56rem, calc(60vh * ${aspect.toFixed(4)}))` }}
      >
        <div className="relative flex flex-col overflow-hidden rounded-xl border border-border bg-black shadow-xl">
          {/* Mock Browser Chrome */}
          <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-muted/80 px-4">
            <div className="h-2.5 w-2.5 rounded-full bg-destructive/80" />
            <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/60" />
            <div className="h-2.5 w-2.5 rounded-full bg-primary/80" />
            <div className="flex min-w-0 flex-1 justify-center">
              <div className="flex h-5 w-full max-w-64 items-center justify-center truncate rounded-md bg-background/50 px-2 font-mono text-[10px] text-muted-foreground/50 select-none">
                live session
              </div>
            </div>
          </div>

          <div className="relative">
            <canvas
              ref={canvasRef}
              width={viewportWidth}
              height={viewportHeight}
              tabIndex={0}
              className={`block h-auto w-full bg-black transition-colors outline-none ${
                sessionState === "ready" && !runActive && interactiveMode
                  ? "cursor-crosshair"
                  : "cursor-default"
              }`}
              onMouseDown={canvasHandlers.onMouseDown}
              onMouseUp={canvasHandlers.onMouseUp}
              onMouseMove={canvasHandlers.onMouseMove}
              onMouseLeave={canvasHandlers.onMouseLeave}
              onContextMenu={canvasHandlers.onContextMenu}
              onKeyDown={canvasHandlers.onKeyDown}
              onKeyUp={canvasHandlers.onKeyUp}
            />
            {sessionState === "ready" && !runActive && !interactiveMode && (
              <div
                className="absolute right-3 bottom-3 cursor-pointer"
                onClick={() => {
                  onInteractiveModeChange(true)
                  canvasRef.current?.focus()
                }}
              >
                <div className="flex items-center gap-1.5 rounded-md border border-border bg-card/90 px-2.5 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur-sm transition-colors select-none hover:border-primary hover:text-foreground">
                  <HugeiconsIcon
                    icon={Cursor01Icon}
                    size={12}
                    color="currentColor"
                    strokeWidth={1.5}
                  />
                  Enable interaction
                </div>
              </div>
            )}
            {sessionState === "ready" && !runActive && interactiveMode && (
              <div className="absolute top-2 right-2">
                <button
                  onClick={() => onInteractiveModeChange(false)}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
                >
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-foreground" />
                  Interacting · click to stop
                </button>
              </div>
            )}
          </div>
        </div>
        {isBusy && statusLabel && !runActive && (
          <p className="text-center text-xs text-muted-foreground">
            {statusLabel}
          </p>
        )}
      </div>
    </div>
  )
}
