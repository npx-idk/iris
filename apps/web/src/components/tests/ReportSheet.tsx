"use client"

import { useEffect } from "react"
import { useCreateBlockNote } from "@blocknote/react"

import { Button } from "@iris/ui/components/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@iris/ui/components/tooltip"
import { Sheet, SheetContent, SheetTitle } from "@iris/ui/components/sheet"

import { useCopyToClipboard } from "@/hooks/useCopyToClipboard"
import { generateHtmlReport } from "@/lib/report-html"
import { TestWithSteps, TestRun } from "@/lib/types"
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

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
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
                    onClick={() => onOpenChange(false)}
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
