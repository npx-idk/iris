"use client"

import { createContext, useContext } from "react"
import type { Folder } from "@/lib/types"

/** Shared state/callbacks for the folder sidebar tree, so the recursive
 *  SidebarFolder nodes don't have to drill ~15 props at every level. */
export interface FolderSidebarContextValue {
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

const FolderSidebarContext = createContext<FolderSidebarContextValue | null>(
  null
)

export const FolderSidebarProvider = FolderSidebarContext.Provider

export function useFolderSidebar(): FolderSidebarContextValue {
  const ctx = useContext(FolderSidebarContext)
  if (!ctx)
    throw new Error("useFolderSidebar must be used within FolderSidebar")
  return ctx
}
