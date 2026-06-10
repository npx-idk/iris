"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { BrowserTab } from "@/lib/types"
import { Button } from "@iris/ui/components/button"

function tabTitle(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname || "New Tab"
  } catch {
    return "New Tab"
  }
}

function TabFavicon({ url }: { url: string }) {
  const [visible, setVisible] = useState(true)
  let origin: string | null = null
  try {
    const u = new URL(url)
    if (u.protocol !== "about:" && u.protocol !== "data:") origin = u.origin
  } catch {
    /* ignore */
  }
  if (!origin || !visible)
    return (
      <span className="h-3 w-3 shrink-0 rounded-sm bg-muted-foreground/20" />
    )
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${origin}/favicon.ico`}
      className="h-3 w-3 shrink-0 rounded-sm"
      onError={() => setVisible(false)}
      alt=""
    />
  )
}

/** Chrome-style tab strip for the live authoring browser. */
export function BrowserTabBar({
  tabs,
  onActivateTab,
  onCloseTab,
}: {
  tabs: BrowserTab[]
  onActivateTab: (id: string) => void
  onCloseTab: (id: string) => void
}) {
  return (
    <div className="flex shrink-0 items-center overflow-x-auto border-b border-border bg-card">
      {tabs.map((t) => (
        <div
          key={t.targetId}
          className={`group flex max-w-52 min-w-0 shrink-0 cursor-pointer items-center gap-1.5 border-r border-border px-3 py-[13px] transition-colors ${
            t.active
              ? "bg-background text-foreground"
              : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          }`}
          onClick={() => onActivateTab(t.targetId)}
        >
          <TabFavicon url={t.url} />
          <span className="min-w-0 flex-1 truncate text-xs">
            {tabTitle(t.url)}
          </span>
          {tabs.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                onCloseTab(t.targetId)
              }}
              className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-60 hover:!opacity-100"
            >
              <HugeiconsIcon
                icon={Cancel01Icon}
                size={10}
                color="currentColor"
                strokeWidth={1.5}
              />
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}
