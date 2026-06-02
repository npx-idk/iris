"use client"

import { useState } from "react"
import { api } from "@/lib/api"
import type { Folder } from "@/lib/types"

interface UseFolderManagementOptions {
  projectId: string
  selectedFolderId: string | null | "all"
  setSelectedFolderId: (id: string | null | "all") => void
  refetchFolders: () => void
  refetchTests: () => void
  setOperationError: (msg: string | null) => void
  onFolderCreated?: (
    createdId: string,
    parentId: string | null | undefined
  ) => void
}

export function useFolderManagement({
  projectId,
  selectedFolderId,
  setSelectedFolderId,
  refetchFolders,
  refetchTests,
  setOperationError,
  onFolderCreated,
}: UseFolderManagementOptions) {
  const [renamingFolder, setRenamingFolder] = useState<{
    id: string
    name: string
  } | null>(null)
  // undefined = closed, null = root level, string = subfolder under that id
  const [creatingParentId, setCreatingParentId] = useState<
    string | null | undefined
  >(undefined)
  const [creatingName, setCreatingName] = useState("")
  const [savingFolder, setSavingFolder] = useState(false)

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault()
    if (!creatingName.trim()) return
    setSavingFolder(true)
    try {
      const created = await api.post<{ id: string }>(
        `/projects/${projectId}/folders`,
        {
          name: creatingName.trim(),
          parentId: creatingParentId ?? null,
        }
      )
      setCreatingName("")
      const parentBeforeReset = creatingParentId
      setCreatingParentId(undefined)
      refetchFolders()
      setSelectedFolderId(created.id)
      onFolderCreated?.(created.id, parentBeforeReset)
    } catch (err) {
      setOperationError(
        err instanceof Error ? err.message : "Failed to create folder"
      )
    } finally {
      setSavingFolder(false)
    }
  }

  async function handleRenameFolder(e: React.FormEvent) {
    e.preventDefault()
    if (!renamingFolder?.name.trim()) return
    try {
      await api.patch(`/folders/${renamingFolder.id}`, {
        name: renamingFolder.name,
      })
      setRenamingFolder(null)
      refetchFolders()
    } catch (err) {
      setOperationError(
        err instanceof Error ? err.message : "Failed to rename folder"
      )
    }
  }

  async function handleDeleteFolder(folderId: string) {
    try {
      await api.delete(`/folders/${folderId}`)
      if (selectedFolderId === folderId) setSelectedFolderId("all")
      refetchFolders()
      refetchTests()
    } catch (err) {
      setOperationError(
        err instanceof Error ? err.message : "Failed to delete folder"
      )
    }
  }

  async function handleMoveFolder(folderId: string, parentId: string | null) {
    try {
      await api.patch(`/folders/${folderId}`, { parentId })
      refetchFolders()
    } catch (err) {
      setOperationError(
        err instanceof Error ? err.message : "Failed to move folder"
      )
    }
  }

  function handleStartSubfolder(parentId: string) {
    if (parentId === "__cancel__") {
      setCreatingParentId(undefined)
      setCreatingName("")
      return
    }
    setCreatingParentId(parentId)
    setCreatingName("")
  }

  function startRenaming(folder: Folder) {
    setRenamingFolder({ id: folder.id, name: folder.name })
  }

  function updateRenamingName(name: string) {
    setRenamingFolder((prev) => (prev ? { ...prev, name } : null))
  }

  return {
    renamingFolder,
    creatingParentId,
    creatingName,
    savingFolder,
    setCreatingParentId,
    setCreatingName,
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteFolder,
    handleMoveFolder,
    handleStartSubfolder,
    startRenaming,
    updateRenamingName,
  }
}
