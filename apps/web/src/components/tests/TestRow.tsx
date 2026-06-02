"use client"

import Link from "next/link"
import { Test, Folder, RunStatus } from "@/lib/types"
import { ROUTES } from "@/lib/routes"
import { StatusDot } from "./StatusDot"
import { Button } from "@iris/ui/components/button"
import { Badge } from "@iris/ui/components/badge"
import { Checkbox } from "@iris/ui/components/animate-ui/components/radix/checkbox"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@iris/ui/components/animate-ui/components/radix/dropdown-menu"

interface TestRowProps {
  test: Test
  flatFolders: { folder: Folder; depth: number }[]
  selected: boolean
  selecting: boolean
  onToggleSelect: (id: string) => void
  confirmDeleteId: string | null
  deleting: boolean
  onSetConfirmDelete: (id: string | null) => void
  onDelete: (id: string) => void
  onMove: (testId: string, folderId: string | null) => void
}

export function TestRow({
  test,
  flatFolders,
  selected,
  selecting,
  onToggleSelect,
  confirmDeleteId,
  deleting,
  onSetConfirmDelete,
  onDelete,
  onMove,
}: TestRowProps) {
  const lastRun = test.runs?.[0]
  return (
    <div
      className={`group flex items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-0 ${selected ? "bg-primary/5" : "hover:bg-muted/30"} ${selecting ? "cursor-pointer" : ""}`}
      onClick={() => selecting && onToggleSelect(test.id)}
    >
      <div onClick={(e) => e.stopPropagation()} className="shrink-0">
        <Checkbox
          checked={selected}
          size="sm"
          onCheckedChange={() => onToggleSelect(test.id)}
        />
      </div>
      <StatusDot status={lastRun?.status as RunStatus | undefined} />
      <Link
        href={ROUTES.test(test.id)}
        className="min-w-0 flex-1 truncate text-sm text-foreground hover:underline"
        onClick={(e) => selecting && e.preventDefault()}
      >
        {test.name}
      </Link>
      {!selecting && (
        <div className="flex shrink-0 items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="text-xs text-muted-foreground tabular-nums">
            {test._count?.steps ?? 0} steps
          </span>
          {!test.enabled && (
            <Badge variant="secondary" className="text-xs">
              off
            </Badge>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="xs"
                className="h-6 px-2 text-xs text-muted-foreground"
              >
                Move
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48">
              <DropdownMenuRadioGroup
                value={test.folderId ?? ""}
                onValueChange={(v) => onMove(test.id, v || null)}
              >
                <DropdownMenuRadioItem value="">Unfiled</DropdownMenuRadioItem>
                {flatFolders.map(({ folder, depth }) => (
                  <DropdownMenuRadioItem key={folder.id} value={folder.id}>
                    {depth > 0 && (
                      <span className="text-muted-foreground/50">
                        {"  ".repeat(depth)}
                      </span>
                    )}
                    {folder.name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {confirmDeleteId === test.id ? (
            <div className="flex items-center gap-1">
              <Button
                size="xs"
                variant="destructive"
                className="h-6 px-2 text-xs"
                disabled={deleting}
                onClick={() => onDelete(test.id)}
              >
                {deleting ? "…" : "Yes"}
              </Button>
              <Button
                size="xs"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() => onSetConfirmDelete(null)}
              >
                No
              </Button>
            </div>
          ) : (
            <Button
              size="xs"
              variant="ghost"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
              onClick={() => onSetConfirmDelete(test.id)}
            >
              Delete
            </Button>
          )}
        </div>
      )}
      {selecting && (
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {test._count?.steps ?? 0} steps
        </span>
      )}
    </div>
  )
}
