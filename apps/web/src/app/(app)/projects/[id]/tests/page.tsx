"use client"

import { useState, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { AnimatePresence } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Folder01Icon } from "@hugeicons/core-free-icons"
import { api } from "@/lib/api"
import { useProject, useProjectTests } from "@/hooks/queries"
import { ROUTES } from "@/lib/routes"
import { Folder } from "@/lib/types"
import {
  buildTree,
  flattenTree,
  findNode,
  getDescendantIds,
  type FolderNode,
} from "@/lib/folder-tree"
import { useFolderManagement } from "@/hooks/useFolderManagement"
import { useTestBulkOps } from "@/hooks/useTestBulkOps"
import { FolderSidebar } from "@/components/tests/FolderSidebar"
import { TestRow } from "@/components/tests/TestRow"
import { BulkBar } from "@/components/tests/BulkBar"
import { Label } from "@iris/ui/components/label"
import { Textarea } from "@iris/ui/components/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@iris/ui/components/animate-ui/components/radix/dialog"
import { Button } from "@iris/ui/components/button"
import { Badge } from "@iris/ui/components/badge"
import { Separator } from "@iris/ui/components/separator"
import { Input } from "@iris/ui/components/input"
import { SidebarTrigger } from "@iris/ui/components/sidebar"
import { Checkbox } from "@iris/ui/components/animate-ui/components/radix/checkbox"
import { GenerateTestsSheet } from "@/components/tests/GenerateTestsSheet"

// ── Schema (module scope — not recreated each render) ─────────────────────────

const newTestSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  startUrl: z
    .string()
    .refine((v) => !v || /^https?:\/\/.+/.test(v), "Enter a valid URL")
    .optional(),
  tags: z.string().optional(),
})
type NewTestValues = z.infer<typeof newTestSchema>

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TestsPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const router = useRouter()

  const [selectedFolderId, setSelectedFolderId] = useState<
    string | null | "all"
  >("all")
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [generateOpen, setGenerateOpen] = useState(false)
  const [newTestOpen, setNewTestOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [operationError, setOperationError] = useState<string | null>(null)

  const { data: tests = [], isLoading, refetch } = useProjectTests(projectId)
  const { data: folders = [], refetch: refetchFolders } = useQuery({
    queryKey: ["folders", projectId],
    queryFn: () => api.get<Folder[]>(`/projects/${projectId}/folders`),
  })
  const { data: project } = useProject(projectId)

  const folderTree = buildTree(folders)
  const flatFolders = flattenTree(folderTree)

  const visibleTests =
    selectedFolderId === "all"
      ? tests
      : selectedFolderId === null
        ? tests.filter((t) => !t.folderId)
        : tests.filter((t) => t.folderId === selectedFolderId)

  const folderMgmt = useFolderManagement({
    projectId,
    selectedFolderId,
    setSelectedFolderId,
    refetchFolders,
    refetchTests: refetch,
    setOperationError,
    onFolderCreated: (_, parentId) => {
      if (parentId)
        setExpandedIds((prev) => new Set([...prev, parentId as string]))
    },
  })

  const bulkOps = useTestBulkOps({ visibleTests, refetch, setOperationError })

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedNode =
    typeof selectedFolderId === "string" && selectedFolderId !== "all"
      ? findNode(folderTree, selectedFolderId)
      : null
  const childFolders: FolderNode[] = selectedNode?.children ?? []

  const selectedFolder = folders.find((f) => f.id === selectedFolderId)
  const sectionTitle =
    selectedFolderId === "all"
      ? "All tests"
      : selectedFolderId === null
        ? "Unfiled"
        : (selectedFolder?.name ?? "Tests")

  const newTestForm = useForm<NewTestValues>({
    resolver: zodResolver(newTestSchema as never),
    mode: "onBlur",
  })

  async function handleCreateTest(values: NewTestValues) {
    const tags =
      values.tags
        ?.split(",")
        .map((t) => t.trim())
        .filter(Boolean) ?? []
    const test = await api.post<{ id: string }>(
      `/projects/${projectId}/tests`,
      {
        name: values.name,
        description: values.description || undefined,
        startUrl: values.startUrl || undefined,
        folderId:
          typeof selectedFolderId === "string" && selectedFolderId !== "all"
            ? selectedFolderId
            : undefined,
        tags,
      }
    )
    newTestForm.reset()
    setNewTestOpen(false)
    refetch()
    router.push(ROUTES.test(test.id))
  }

  async function handleExport() {
    const data = await api.get(`/projects/${projectId}/export`)
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `iris-suite-${projectId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    setImporting(true)
    try {
      const json = JSON.parse(await file.text())
      await api.post(
        `/projects/${projectId}/import`,
        json.tests ? { tests: json.tests } : json
      )
      refetch()
    } finally {
      setImporting(false)
    }
  }

  const testRowProps = {
    flatFolders,
    confirmDeleteId,
    deleting,
    onSetConfirmDelete: setConfirmDeleteId,
    onDelete: async (testId: string) => {
      setDeleting(true)
      try {
        await api.delete(`/tests/${testId}`)
        setConfirmDeleteId(null)
        refetch()
      } finally {
        setDeleting(false)
      }
    },
    onMove: async (testId: string, folderId: string | null) => {
      await api.patch(`/tests/${testId}`, { folderId })
      refetch()
    },
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link
            href={ROUTES.dashboard}
            className="transition-colors hover:text-foreground"
          >
            Projects
          </Link>
          <span>/</span>
          <Link
            href={ROUTES.project(projectId)}
            className="transition-colors hover:text-foreground"
          >
            Project
          </Link>
          <span>/</span>
          <span className="font-medium text-foreground">Tests</span>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              api.post(`/projects/${projectId}/runs`).then(() => refetch())
            }
          >
            ▶ Run all
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGenerateOpen(true)}
          >
            ✨ Generate
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={tests.length === 0}
          >
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => importRef.current?.click()}
            disabled={importing}
          >
            {importing ? "Importing…" : "Import"}
          </Button>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportFile}
          />
          <Button size="sm" onClick={() => setNewTestOpen(true)}>
            + New test
          </Button>
        </div>
      </header>

      {operationError && (
        <div className="flex items-center justify-between gap-3 border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <span>{operationError}</span>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setOperationError(null)}
            className="shrink-0 text-xs underline"
          >
            Dismiss
          </Button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <FolderSidebar
          isLoading={isLoading}
          folderTree={folderTree}
          flatFolders={flatFolders}
          tests={tests}
          selectedFolderId={selectedFolderId}
          expandedIds={expandedIds}
          renamingFolder={folderMgmt.renamingFolder}
          onSelectFolder={setSelectedFolderId}
          onToggleExpand={toggleExpand}
          onStartRename={folderMgmt.startRenaming}
          onRenameSubmit={folderMgmt.handleRenameFolder}
          onRenameChange={folderMgmt.updateRenamingName}
          onDeleteFolder={folderMgmt.handleDeleteFolder}
          onStartSubfolder={folderMgmt.handleStartSubfolder}
          onMoveFolder={folderMgmt.handleMoveFolder}
          creatingParentId={folderMgmt.creatingParentId}
          creatingName={folderMgmt.creatingName}
          onCreatingNameChange={folderMgmt.setCreatingName}
          onCreateSubmit={folderMgmt.handleCreateFolder}
          savingFolder={folderMgmt.savingFolder}
          onNewFolder={() => {
            folderMgmt.setCreatingParentId(null)
            folderMgmt.setCreatingName("")
          }}
        />

        <main className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
            <Checkbox
              checked={
                bulkOps.someVisibleSelected
                  ? "indeterminate"
                  : bulkOps.allVisibleSelected
              }
              size="sm"
              onCheckedChange={bulkOps.toggleSelectAll}
              disabled={visibleTests.length === 0}
            />
            <h2 className="text-sm font-semibold text-foreground">
              {sectionTitle}
            </h2>
            <Badge variant="secondary" className="text-xs tabular-nums">
              {visibleTests.length}
            </Badge>
          </div>

          {childFolders.length === 0 && visibleTests.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-muted-foreground">
                {selectedFolderId === "all"
                  ? "No tests yet"
                  : "No tests in this folder"}
              </p>
              <Button size="sm" onClick={() => setNewTestOpen(true)}>
                + New test
              </Button>
            </div>
          ) : (
            <div>
              {childFolders.length > 0 && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 border-b border-border p-4">
                  {childFolders.map((folder) => {
                    const subtreeIds = getDescendantIds(folder)
                    const count = tests.filter(
                      (t) => t.folderId && subtreeIds.has(t.folderId)
                    ).length
                    return (
                      <button
                        key={folder.id}
                        onClick={() => setSelectedFolderId(folder.id)}
                        className="flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-accent/50"
                      >
                        <HugeiconsIcon
                          icon={Folder01Icon}
                          className="size-6 text-muted-foreground"
                        />
                        <div className="w-full">
                          <p className="truncate text-sm font-medium text-foreground">
                            {folder.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {count} {count === 1 ? "test" : "tests"}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
              {visibleTests.length > 0 && (
                <div>
                  {visibleTests.map((test) => (
                    <TestRow
                      key={test.id}
                      test={test}
                      selected={bulkOps.selectedIds.has(test.id)}
                      selecting={bulkOps.selecting}
                      onToggleSelect={bulkOps.toggleSelect}
                      {...testRowProps}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <AnimatePresence>
        {bulkOps.selecting && (
          <BulkBar
            count={bulkOps.selectedIds.size}
            folders={folders}
            onMove={bulkOps.handleBulkMove}
            onDelete={bulkOps.handleBulkDelete}
            onClear={bulkOps.clearSelection}
            deleting={bulkOps.bulkDeleting}
            moving={bulkOps.bulkMoving}
          />
        )}
      </AnimatePresence>

      <GenerateTestsSheet
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        projectId={projectId}
        defaultUrl={project?.baseUrl ?? ""}
        onSaved={refetch}
      />

      <Dialog
        open={newTestOpen}
        onOpenChange={(o) => {
          if (!o) newTestForm.reset()
          setNewTestOpen(o)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New test</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={newTestForm.handleSubmit(handleCreateTest)}
            className="flex flex-col gap-4 py-2"
          >
            <div className="space-y-1.5">
              <Label htmlFor="nt-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nt-name"
                placeholder="Login flow"
                {...newTestForm.register("name")}
              />
              {newTestForm.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {newTestForm.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nt-desc">
                Description{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="nt-desc"
                placeholder="What does this test verify?"
                {...newTestForm.register("description")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nt-url">
                Start URL{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Input
                id="nt-url"
                placeholder="https://example.com/login"
                {...newTestForm.register("startUrl")}
              />
              {newTestForm.formState.errors.startUrl && (
                <p className="text-xs text-destructive">
                  {newTestForm.formState.errors.startUrl.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Overrides the project base URL
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nt-tags">
                Tags{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Input
                id="nt-tags"
                placeholder="smoke, auth, critical"
                {...newTestForm.register("tags")}
              />
              <p className="text-xs text-muted-foreground">Comma-separated</p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setNewTestOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={newTestForm.formState.isSubmitting}
              >
                {newTestForm.formState.isSubmitting
                  ? "Creating…"
                  : "Create test"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
