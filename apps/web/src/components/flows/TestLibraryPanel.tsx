"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { TestTube01Icon } from "@hugeicons/core-free-icons"
import { TEST_DRAG_MIME } from "@/lib/constants"
import { Test } from "@/lib/types"
import { Badge } from "@iris/ui/components/badge"

/** Left-hand list of the project's tests; items are dragged onto the flow canvas. */
export function TestLibraryPanel({ tests }: { tests: Test[] }) {
  return (
    <aside className="z-10 flex w-56 shrink-0 flex-col overflow-hidden border-r border-border bg-background">
      <div className="border-b border-border px-3 py-2.5">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Test suites
        </p>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {tests.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            No tests yet
          </p>
        ) : (
          tests.map((test) => (
            <div
              key={test.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(TEST_DRAG_MIME, test.id)
                e.dataTransfer.effectAllowed = "move"
              }}
              className="group flex cursor-grab items-center gap-2 rounded-md px-2 py-2 transition-colors hover:bg-accent/50 active:cursor-grabbing"
            >
              <HugeiconsIcon
                icon={TestTube01Icon}
                size={13}
                color="currentColor"
                strokeWidth={1.5}
                className="shrink-0 text-muted-foreground"
              />
              <span className="flex-1 truncate text-xs text-foreground">
                {test.name}
              </span>
              <Badge
                variant="secondary"
                className="shrink-0 text-xs tabular-nums opacity-0 group-hover:opacity-100"
              >
                {test._count?.steps ?? 0}
              </Badge>
            </div>
          ))
        )}
      </div>
      <div className="border-t border-border px-3 py-2">
        <p className="text-xs text-muted-foreground">
          Drag tests onto the canvas
        </p>
      </div>
    </aside>
  )
}
