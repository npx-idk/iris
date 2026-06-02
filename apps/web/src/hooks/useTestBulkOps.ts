"use client"

import { useState } from "react"
import { api } from "@/lib/api"
import type { Test } from "@/lib/types"

interface UseTestBulkOpsOptions {
  visibleTests: Test[]
  refetch: () => void
  setOperationError: (msg: string | null) => void
}

export function useTestBulkOps({
  visibleTests,
  refetch,
  setOperationError,
}: UseTestBulkOpsOptions) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkMoving, setBulkMoving] = useState(false)

  const selectedVisibleCount = visibleTests.filter((t) =>
    selectedIds.has(t.id)
  ).length
  const allVisibleSelected =
    visibleTests.length > 0 && selectedVisibleCount === visibleTests.length
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected
  const selecting = selectedIds.size > 0

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        visibleTests.forEach((t) => next.delete(t.id))
        return next
      })
    } else {
      setSelectedIds(
        (prev) => new Set([...prev, ...visibleTests.map((t) => t.id)])
      )
    }
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  async function handleBulkDelete() {
    setBulkDeleting(true)
    try {
      await Promise.all(
        [...selectedIds].map((id) => api.delete(`/tests/${id}`))
      )
      clearSelection()
      refetch()
    } catch (err) {
      setOperationError(
        err instanceof Error ? err.message : "Failed to delete tests"
      )
    } finally {
      setBulkDeleting(false)
    }
  }

  async function handleBulkMove(folderId: string | null) {
    setBulkMoving(true)
    try {
      await Promise.all(
        [...selectedIds].map((id) => api.patch(`/tests/${id}`, { folderId }))
      )
      clearSelection()
      refetch()
    } catch (err) {
      setOperationError(
        err instanceof Error ? err.message : "Failed to move tests"
      )
    } finally {
      setBulkMoving(false)
    }
  }

  return {
    selectedIds,
    selecting,
    selectedVisibleCount,
    allVisibleSelected,
    someVisibleSelected,
    bulkDeleting,
    bulkMoving,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    handleBulkDelete,
    handleBulkMove,
  }
}
