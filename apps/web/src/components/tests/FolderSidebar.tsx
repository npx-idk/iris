"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  Folder01Icon,
  FolderOpenIcon,
  GridIcon,
  Add01Icon,
  FolderTransferIcon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@iris/ui/components/button"
import { Input } from "@iris/ui/components/input"
import { Skeleton } from "@iris/ui/components/skeleton"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@iris/ui/components/animate-ui/components/radix/dropdown-menu"
import type { Folder, Test } from "@/lib/types"
import type { FolderNode } from "@/lib/folder-tree"
import { getDescendantIds } from "@/lib/folder-tree"

// ── SidebarFolder (recursive) ─────────────────────────────────────────────────

interface SidebarFolderProps {
  node: FolderNode
  depth?: number
  selectedFolderId: string | null | "all"
  expandedIds: Set<string>
  renamingFolder: { id: string; name: string } | null
  onSelect: (id: string | null | "all") => void
  onToggleExpand: (id: string) => void
  onStartRename: (folder: Folder) => void
  onRenameSubmit: (e: React.FormEvent) => void
  onRenameChange: (name: string) => void
  onDelete: (id: string) => void
  onStartSubfolder: (parentId: string) => void
  onMoveFolder: (folderId: string, parentId: string | null) => void
  flatFolders: { folder: Folder; depth: number }[]
  creatingParentId: string | null | undefined
  creatingName: string
  onCreatingNameChange: (v: string) => void
  onCreateSubmit: (e: React.FormEvent) => void
  savingFolder: boolean
}

function SidebarFolder({
  node,
  depth = 0,
  selectedFolderId,
  expandedIds,
  renamingFolder,
  onSelect,
  onToggleExpand,
  onStartRename,
  onRenameSubmit,
  onRenameChange,
  onDelete,
  onStartSubfolder,
  onMoveFolder,
  flatFolders,
  creatingParentId,
  creatingName,
  onCreatingNameChange,
  onCreateSubmit,
  savingFolder,
}: SidebarFolderProps) {
  const isSelected = selectedFolderId === node.id
  const isExpanded = expandedIds.has(node.id)
  const hasChildren = node.children.length > 0
  const isRenaming = renamingFolder?.id === node.id
  const pl = depth * 12
  const excludeIds = getDescendantIds(node)
  const moveTargets = flatFolders.filter(
    ({ folder }) => !excludeIds.has(folder.id)
  )

  return (
    <>
      <div
        className={`group/folder flex items-center rounded-md transition-colors ${isSelected ? "bg-accent" : "hover:bg-accent/50"}`}
        style={{ paddingLeft: pl }}
      >
        <button
          className={`flex size-5 shrink-0 items-center justify-center text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""} ${!hasChildren ? "invisible" : ""}`}
          onClick={() => onToggleExpand(node.id)}
        >
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
        </button>

        {isRenaming ? (
          <form
            onSubmit={onRenameSubmit}
            className="flex min-w-0 flex-1 items-center gap-1 py-1 pr-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Input
              autoFocus
              value={renamingFolder!.name}
              onChange={(e) => onRenameChange(e.target.value)}
              className="h-6 flex-1 text-xs"
              onKeyDown={(e) =>
                e.key === "Escape" &&
                onStartRename({ ...node, name: "" } as Folder)
              }
            />
            <Button
              type="submit"
              size="xs"
              className="h-5 shrink-0 px-1.5 text-xs"
            >
              ✓
            </Button>
          </form>
        ) : (
          <>
            <button
              className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 pr-1 text-left"
              onClick={() => onSelect(node.id)}
            >
              <HugeiconsIcon
                icon={isSelected || isExpanded ? FolderOpenIcon : Folder01Icon}
                className={`size-4 shrink-0 ${isSelected ? "text-foreground" : "text-muted-foreground"}`}
              />
              <span
                className={`flex-1 truncate text-sm ${isSelected ? "font-medium text-accent-foreground" : "text-muted-foreground"}`}
              >
                {node.name}
              </span>
            </button>
            <div
              className="flex shrink-0 items-center gap-0.5 pr-1 opacity-0 transition-opacity group-hover/folder:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                size="xs"
                variant="ghost"
                className="h-5 w-5 p-0 text-muted-foreground"
                title="Add subfolder"
                onClick={() => {
                  onToggleExpand(node.id)
                  onStartSubfolder(node.id)
                }}
              >
                +
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="xs"
                    variant="ghost"
                    className="h-5 w-5 p-0 text-muted-foreground"
                    title="Move to folder"
                  >
                    <HugeiconsIcon
                      icon={FolderTransferIcon}
                      className="size-3"
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="right"
                  align="start"
                  className="w-44"
                >
                  <DropdownMenuItem
                    onSelect={() => onMoveFolder(node.id, null)}
                    className={node.parentId === null ? "font-medium" : ""}
                  >
                    Root level
                  </DropdownMenuItem>
                  {moveTargets.map(({ folder, depth: d }) => (
                    <DropdownMenuItem
                      key={folder.id}
                      onSelect={() => onMoveFolder(node.id, folder.id)}
                      className={
                        node.parentId === folder.id ? "font-medium" : ""
                      }
                    >
                      {d > 0 && (
                        <span className="mr-0.5 text-muted-foreground/50">
                          {"  ".repeat(d)}
                        </span>
                      )}
                      {folder.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="xs"
                variant="ghost"
                className="h-5 w-5 p-0 text-muted-foreground"
                onClick={() => onStartRename(node)}
              >
                ✎
              </Button>
              <Button
                size="xs"
                variant="ghost"
                className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(node.id)}
              >
                ✕
              </Button>
            </div>
          </>
        )}
      </div>

      {creatingParentId === node.id && (
        <form
          onSubmit={onCreateSubmit}
          className="flex items-center gap-1 py-1 pr-1"
          style={{ paddingLeft: pl + 20 }}
        >
          <Input
            autoFocus
            value={creatingName}
            onChange={(e) => onCreatingNameChange(e.target.value)}
            placeholder="Subfolder name"
            className="h-6 flex-1 text-xs"
            onKeyDown={(e) =>
              e.key === "Escape" && onStartSubfolder("__cancel__")
            }
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

      {isExpanded &&
        node.children.map((child) => (
          <SidebarFolder
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedFolderId={selectedFolderId}
            expandedIds={expandedIds}
            renamingFolder={renamingFolder}
            onSelect={onSelect}
            onToggleExpand={onToggleExpand}
            onStartRename={onStartRename}
            onRenameSubmit={onRenameSubmit}
            onRenameChange={onRenameChange}
            onDelete={onDelete}
            onStartSubfolder={onStartSubfolder}
            onMoveFolder={onMoveFolder}
            flatFolders={flatFolders}
            creatingParentId={creatingParentId}
            creatingName={creatingName}
            onCreatingNameChange={onCreatingNameChange}
            onCreateSubmit={onCreateSubmit}
            savingFolder={savingFolder}
          />
        ))}
    </>
  )
}

// ── FolderSidebar panel ───────────────────────────────────────────────────────

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
  const sharedProps = {
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
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded-md" />
            ))}
          </div>
        ) : (
          <>
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
              <SidebarFolder key={node.id} node={node} {...sharedProps} />
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
          </>
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
