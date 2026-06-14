"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useCreateBlockNote } from "@blocknote/react"

import { Button } from "@iris/ui/components/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@iris/ui/components/tooltip"
import { Sheet, SheetContent, SheetTitle } from "@iris/ui/components/sheet"

import { api } from "@/lib/api"
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard"
import { generateHtmlReport } from "@/lib/report-html"
import { ROUTES } from "@/lib/routes"
import { TestWithSteps, TestRun, SharedReport } from "@/lib/types"
import { BlockNoteReportEditor } from "./BlockNoteReportEditor"

interface ReportSheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  test: TestWithSteps | undefined
  activeRun: TestRun | undefined
  resolvedTheme: string | undefined
  project: { baseUrl?: string } | undefined
}

export function ReportSheet({
  isOpen,
  onOpenChange,
  test,
  activeRun,
  resolvedTheme,
  project,
}: ReportSheetProps) {
  const { copied, copy } = useCopyToClipboard()
  const editor = useCreateBlockNote()
  const [shareState, setShareState] = useState<
    "idle" | "sharing" | "copied" | "error"
  >("idle")
  const [revoking, setRevoking] = useState(false)

  // Returns null (empty body) when the run's report has not been shared yet.
  const { data: existingShare, refetch: refetchShare } = useQuery({
    queryKey: ["report-share", activeRun?.id],
    queryFn: () =>
      api.get<SharedReport | null>(`/reports/share/${activeRun!.id}`),
    enabled: isOpen && !!activeRun,
  })
  const isShared = !!existingShare && typeof existingShare === "object"

  function handleOpenChange(open: boolean) {
    if (!open) setShareState("idle")
    onOpenChange(open)
  }

  useEffect(() => {
    let timeout: NodeJS.Timeout
    if (isOpen && editor && activeRun) {
      async function loadReport() {
        try {
          const html = generateHtmlReport(test, activeRun, project)
          const blocks = await editor.tryParseHTMLToBlocks(html)
          timeout = setTimeout(() => {
            try {
              editor.replaceBlocks(editor.document, blocks)
            } catch (e) {
              console.warn("BlockNote editor not fully mounted yet", e)
            }
          }, 200)
        } catch (e) {
          console.warn("Failed to parse report HTML", e)
        }
      }
      loadReport()
    }
    return () => clearTimeout(timeout)
  }, [isOpen, editor, activeRun]) // eslint-disable-line react-hooks/exhaustive-deps

  async function downloadReport() {
    if (!editor) return
    const mdContent = await editor.blocksToMarkdownLossy(editor.document)
    const blob = new Blob([mdContent], { type: "text/markdown;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `test-report-${test?.id}-${activeRun?.id}.md`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  async function copyToClipboard() {
    if (!editor) return
    const mdContent = await editor.blocksToMarkdownLossy(editor.document)
    copy(mdContent)
  }

  async function shareReport() {
    if (!editor || !activeRun || !test) return
    setShareState("sharing")
    try {
      const { token } = await api.post<SharedReport>("/reports/share", {
        runId: activeRun.id,
        title: `Test Execution Report: ${test.name}`,
        content: editor.document,
      })
      const url = `${window.location.origin}${ROUTES.sharedReport(token)}`
      await navigator.clipboard.writeText(url)
      refetchShare()
      setShareState("copied")
      setTimeout(() => setShareState("idle"), 2000)
    } catch {
      setShareState("error")
      setTimeout(() => setShareState("idle"), 2000)
    }
  }

  async function unshareReport() {
    if (!activeRun) return
    setRevoking(true)
    try {
      await api.delete(`/reports/share/${activeRun.id}`)
      await refetchShare()
    } finally {
      setRevoking(false)
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="mx-5 flex !h-[95vh] flex-col overflow-hidden rounded-lg p-6 sm:max-w-none"
      >
        <div className="mb-4 flex shrink-0 items-center justify-between border-b border-border pb-4">
          <div>
            <SheetTitle className="text-lg font-semibold">
              Test Execution Report
            </SheetTitle>
            <p className="text-xs text-muted-foreground">
              View and edit rich test execution results
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={shareReport}
                    disabled={shareState === "sharing"}
                  >
                    {shareState === "copied" ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="animate-in text-primary duration-200 fade-in zoom-in"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="18" cy="5" r="3" />
                        <circle cx="6" cy="12" r="3" />
                        <circle cx="18" cy="19" r="3" />
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                      </svg>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {shareState === "copied"
                      ? "Public link copied!"
                      : shareState === "sharing"
                        ? "Publishing…"
                        : shareState === "error"
                          ? "Failed to share"
                          : isShared
                            ? "Update public link & copy"
                            : "Share public link"}
                  </p>
                </TooltipContent>
              </Tooltip>

              {isShared && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={unshareReport}
                      disabled={revoking}
                      className="text-destructive hover:text-destructive"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71" />
                        <path d="m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71" />
                        <line x1="8" x2="8" y1="2" y2="5" />
                        <line x1="2" x2="5" y1="8" y2="8" />
                        <line x1="16" x2="16" y1="19" y2="22" />
                        <line x1="19" x2="22" y1="16" y2="16" />
                      </svg>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{revoking ? "Removing…" : "Remove public link"}</p>
                  </TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyToClipboard}
                  >
                    {copied ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="animate-in text-primary duration-200 fade-in zoom-in"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect
                          x="9"
                          y="9"
                          width="13"
                          height="13"
                          rx="2"
                          ry="2"
                        />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{copied ? "Copied!" : "Copy markdown"}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={downloadReport}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Download report (.md)</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenChange(false)}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Close report</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <div className="bn-editor-container min-h-0 flex-1 overflow-y-auto rounded-md border border-border bg-card p-4 [--bn-colors-editor-background:transparent] [&_.bn-editor]:!p-6 [&_.bn-editor]:!pl-14 [&_.bn-editor]:!font-sans [&_.bn-editor_*]:!font-sans [&_.bn-root]:!bg-transparent [&_.bn-root]:!font-sans [&_.bn-root_*]:!font-sans">
          {editor && (
            <BlockNoteReportEditor
              editor={editor}
              resolvedTheme={resolvedTheme}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
