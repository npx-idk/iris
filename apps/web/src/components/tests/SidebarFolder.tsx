"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  Folder01Icon,
  FolderOpenIcon,
  FolderTransferIcon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@iris/ui/components/button"
import { Input } from "@iris/ui/components/input"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@iris/ui/components/animate-ui/components/radix/dropdown-menu"
import type { Folder } from "@/lib/types"
import type { FolderNode } from "@/lib/folder-tree"
import { getDescendantIds } from "@/lib/folder-tree"
import { useFolderSidebar } from "./folder-sidebar-context"

/** One folder row in the sidebar tree; renders its children recursively. */
export function SidebarFolder({
  node,
  depth = 0,
}: {
  node: FolderNode
  depth?: number
}) {
  const {
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
  } = useFolderSidebar()

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
          <SidebarFolder key={child.id} node={child} depth={depth + 1} />
        ))}
    </>
  )
}
