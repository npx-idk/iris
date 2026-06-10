"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Folder01Icon, GridIcon, Add01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@iris/ui/components/button"
import { Input } from "@iris/ui/components/input"
import { ListSkeleton } from "@/components/shared/ListSkeleton"
import type { Folder, Test } from "@/lib/types"
import type { FolderNode } from "@/lib/folder-tree"
import {
  FolderSidebarProvider,
  type FolderSidebarContextValue,
} from "./folder-sidebar-context"
import { SidebarFolder } from "./SidebarFolder"

interface FolderSidebarProps {
  isLoading: boolean
  folderTree: FolderNode[]
  flatFolders: { folder: Folder; depth: number }[]
  tests: Test[]
  selectedFolderId: string | null | "all"
  expandedIds: Set<string>
  renamingFolder: { id: string; name: string } | null
  onSelectFolder: (id: string | null | "all") => void
  onToggleExpand: (id: string) => void
  onStartRename: (folder: Folder) => void
  onRenameSubmit: (e: React.FormEvent) => void
  onRenameChange: (name: string) => void
  onDeleteFolder: (id: string) => void
  onStartSubfolder: (parentId: string) => void
  onMoveFolder: (folderId: string, parentId: string | null) => void
  creatingParentId: string | null | undefined
  creatingName: string
  onCreatingNameChange: (v: string) => void
  onCreateSubmit: (e: React.FormEvent) => void
  savingFolder: boolean
  onNewFolder: () => void
}

export function FolderSidebar({
  isLoading,
  folderTree,
  flatFolders,
  tests,
  selectedFolderId,
  expandedIds,
  renamingFolder,
  onSelectFolder,
  onToggleExpand,
  onStartRename,
  onRenameSubmit,
  onRenameChange,
  onDeleteFolder,
  onStartSubfolder,
  onMoveFolder,
  creatingParentId,
  creatingName,
  onCreatingNameChange,
  onCreateSubmit,
  savingFolder,
  onNewFolder,
}: FolderSidebarProps) {
  const contextValue: FolderSidebarContextValue = {
    selectedFolderId,
    expandedIds,
    renamingFolder,
    onSelect: onSelectFolder,
    onToggleExpand,
    onStartRename,
    onRenameSubmit,
    onRenameChange,
    onDelete: onDeleteFolder,
    onStartSubfolder,
    onMoveFolder,
    flatFolders,
    creatingParentId,
    creatingName,
    onCreatingNameChange,
    onCreateSubmit,
    savingFolder,
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col overflow-hidden border-r border-border">
      <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {isLoading ? (
          <div className="space-y-1 p-1">
            <ListSkeleton count={3} className="h-8 w-full rounded-md" />
          </div>
        ) : (
          <FolderSidebarProvider value={contextValue}>
            <button
              onClick={() => onSelectFolder("all")}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                selectedFolderId === "all"
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              }`}
            >
              <HugeiconsIcon icon={GridIcon} className="size-4 shrink-0" />
              <span className="flex-1 truncate text-left">All tests</span>
              <span className="text-xs tabular-nums">{tests.length}</span>
            </button>

            {folderTree.map((node) => (
              <SidebarFolder key={node.id} node={node} />
            ))}

            {creatingParentId === null && (
              <form
                onSubmit={onCreateSubmit}
                className="flex items-center gap-1 px-2 py-1"
              >
                <Input
                  autoFocus
                  value={creatingName}
                  onChange={(e) => onCreatingNameChange(e.target.value)}
                  placeholder="Folder name"
                  className="h-6 flex-1 text-xs"
                  onKeyDown={(e) => e.key === "Escape" && onSelectFolder("all")}
                />
                <Button
                  type="submit"
                  size="xs"
                  className="h-5 shrink-0 px-1.5 text-xs"
                  disabled={savingFolder || !creatingName.trim()}
                >
                  {savingFolder ? "…" : "✓"}
                </Button>
              </form>
            )}

            {tests.some((t) => !t.folderId) && (
              <button
                onClick={() => onSelectFolder(null)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                  selectedFolderId === null
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                <HugeiconsIcon
                  icon={Folder01Icon}
                  className="size-4 shrink-0 opacity-40"
                />
                <span className="flex-1 truncate text-left">Unfiled</span>
                <span className="text-xs tabular-nums">
                  {tests.filter((t) => !t.folderId).length}
                </span>
              </button>
            )}
          </FolderSidebarProvider>
        )}
      </div>

      <div className="border-t border-border p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={onNewFolder}
        >
          <HugeiconsIcon icon={Add01Icon} className="size-4" />
          New folder
        </Button>
      </div>
    </aside>
  )
}
