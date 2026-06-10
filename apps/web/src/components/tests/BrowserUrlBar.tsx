"use client"

import { RefObject } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Refresh01Icon,
} from "@hugeicons/core-free-icons"
import { BrowserTab } from "@/lib/types"
import { Button } from "@iris/ui/components/button"

/** Back/forward/reload buttons + editable URL field for the live browser. */
export function BrowserUrlBar({
  urlInput,
  urlFocusedRef,
  urlBarRef,
  browserTabs,
  onUrlChange,
  onNavigate,
  onBack,
  onForward,
  onReload,
}: {
  urlInput: string
  urlFocusedRef: RefObject<boolean>
  urlBarRef: RefObject<HTMLInputElement | null>
  browserTabs: BrowserTab[]
  onUrlChange: (v: string) => void
  onNavigate: (url: string) => void
  onBack: () => void
  onForward: () => void
  onReload: () => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-border bg-card px-2 py-1.5">
      <Button
        variant="ghost"
        size="icon"
        onClick={onBack}
        title="Go back"
        className="h-7 w-7 text-muted-foreground"
      >
        <HugeiconsIcon
          icon={ArrowLeft01Icon}
          size={14}
          color="currentColor"
          strokeWidth={1.5}
        />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onForward}
        title="Go forward"
        className="h-7 w-7 text-muted-foreground"
      >
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          size={14}
          color="currentColor"
          strokeWidth={1.5}
        />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onReload}
        title="Reload"
        className="h-7 w-7 text-muted-foreground"
      >
        <HugeiconsIcon
          icon={Refresh01Icon}
          size={14}
          color="currentColor"
          strokeWidth={1.5}
        />
      </Button>
      <div className="ml-1 flex h-7 flex-1 items-center rounded-md border border-border bg-muted/50 px-2.5 transition-all focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
        <input
          ref={urlBarRef}
          type="text"
          value={urlInput}
          onChange={(e) => onUrlChange(e.target.value)}
          onFocus={(e) => {
            urlFocusedRef.current = true
            e.target.select()
          }}
          onBlur={() => {
            urlFocusedRef.current = false
            const active = browserTabs.find((t) => t.active)
            if (active) onUrlChange(active.url)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onNavigate(urlInput)
              urlFocusedRef.current = false
            }
            if (e.key === "Escape") {
              urlFocusedRef.current = false
              urlBarRef.current?.blur()
              const active = browserTabs.find((t) => t.active)
              if (active) onUrlChange(active.url)
            }
          }}
          placeholder="Enter URL…"
          className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/50"
          spellCheck={false}
        />
      </div>
    </div>
  )
}
