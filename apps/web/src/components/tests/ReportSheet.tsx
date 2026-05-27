'use client'

import { useState, useEffect } from 'react'
import {
  useCreateBlockNote,
  SideMenuController,
  SideMenu,
  DragHandleMenu,
  RemoveBlockItem,
  BlockColorsItem,
  useBlockNoteEditor
} from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'
import '@blocknote/shadcn/style.css'
import '@blocknote/core/fonts/inter.css'

import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Popover, PopoverContent, PopoverTrigger } from '@workspace/ui/components/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@workspace/ui/components/select'
import { Card, CardContent } from '@workspace/ui/components/card'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@workspace/ui/components/tooltip'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@workspace/ui/components/animate-ui/components/radix/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/animate-ui/components/radix/tabs'
import { Toggle } from '@workspace/ui/components/animate-ui/components/radix/toggle'
import { Sheet, SheetContent, SheetTitle } from '@workspace/ui/components/sheet'

import { TestWithSteps, TestRun } from '@/lib/types'

const blockNoteShadcnComponents = {
  Badge: { Badge },
  Button: { Button },
  Card: { Card, CardContent },
  DropdownMenu: {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
  },
  Input: { Input },
  Label: { Label },
  Popover: { Popover, PopoverContent, PopoverTrigger },
  Select: { Select, SelectContent, SelectItem, SelectTrigger, SelectValue },
  Skeleton: { Skeleton },
  Tabs: { Tabs, TabsContent, TabsList, TabsTrigger },
  Toggle: { Toggle },
  Tooltip: { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger },
}

const CustomDragHandleMenu = (props: any) => {
  const editor = useBlockNoteEditor();

  const handleUpdateBlockType = (type: string, headingLevel?: number) => {
    if (props.block) {
      if (type === 'heading' && headingLevel) {
        editor.updateBlock(props.block, {
          type,
          props: { level: headingLevel }
        } as any);
      } else {
        editor.updateBlock(props.block, {
          type
        } as any);
      }
    }
  };

  return (
    <DragHandleMenu>
      <RemoveBlockItem {...props}>Delete</RemoveBlockItem>
      <BlockColorsItem {...props}>Colors</BlockColorsItem>
      
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className="w-full flex items-center gap-2 cursor-pointer py-1.5 px-2 text-xs rounded-sm hover:bg-accent text-foreground outline-none">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1 h-3.5 w-3.5"><path d="M16 3h5v5"/><path d="M8 21H3v-5"/><path d="M12 20v-8"/><path d="M12 12V4"/><path d="m21 3-7.5 7.5"/><path d="M3 21l7.5-7.5"/></svg>
          Turn into
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="z-[9999] bg-popover text-popover-foreground border border-border rounded-md shadow-md p-1 min-w-[130px]">
          <DropdownMenuItem className="cursor-pointer py-1 px-2 text-xs rounded-sm hover:bg-accent text-foreground outline-none" onClick={() => handleUpdateBlockType("paragraph")}>
            Paragraph
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer py-1 px-2 text-xs rounded-sm hover:bg-accent text-foreground outline-none" onClick={() => handleUpdateBlockType("heading", 1)}>
            Heading 1
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer py-1 px-2 text-xs rounded-sm hover:bg-accent text-foreground outline-none" onClick={() => handleUpdateBlockType("heading", 2)}>
            Heading 2
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer py-1 px-2 text-xs rounded-sm hover:bg-accent text-foreground outline-none" onClick={() => handleUpdateBlockType("heading", 3)}>
            Heading 3
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer py-1 px-2 text-xs rounded-sm hover:bg-accent text-foreground outline-none" onClick={() => handleUpdateBlockType("bulletListItem")}>
            Bullet List
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer py-1 px-2 text-xs rounded-sm hover:bg-accent text-foreground outline-none" onClick={() => handleUpdateBlockType("numberedListItem")}>
            Numbered List
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </DragHandleMenu>
  );
};

const CustomSideMenu = (props: any) => (
  <SideMenu {...props} dragHandleMenu={CustomDragHandleMenu} />
);

interface ReportSheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  test: TestWithSteps | undefined
  activeRun: TestRun | undefined
  resolvedTheme: string | undefined
  project: any
}

export function ReportSheet({ isOpen, onOpenChange, test, activeRun, resolvedTheme, project }: ReportSheetProps) {
  const [copied, setCopied] = useState(false)
  const editor = useCreateBlockNote()

  useEffect(() => {
    let timeout: NodeJS.Timeout
    if (isOpen && editor && activeRun) {
      async function loadReport() {
        try {
          const html = generateHtmlReport()
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

  function generateHtmlReport() {
    if (!test || !activeRun) return ''
    
    const duration = activeRun.finishedAt && activeRun.createdAt
      ? ((new Date(activeRun.finishedAt).getTime() - new Date(activeRun.createdAt).getTime()) / 1000).toFixed(1) + 's'
      : 'N/A'

    const stepsList = activeRun.stepResults ?? []
    
    let html = `<h1>Test Execution Report: ${test.name}</h1>`
    if (test.description) {
      html += `<p><em>${test.description}</em></p>`
    }
    html += `<h2>Summary</h2>`
    html += `<ul>`
    html += `<li><strong>Status</strong>: ${activeRun.status}</li>`
    html += `<li><strong>Run ID</strong>: <code>${activeRun.id}</code></li>`
    html += `<li><strong>Date</strong>: ${new Date(activeRun.createdAt).toLocaleString()}</li>`
    html += `<li><strong>Browser Environment</strong>: ${activeRun.browserEnv ?? 'N/A'}</li>`
    html += `<li><strong>Steps</strong>: ${activeRun.passedSteps} / ${activeRun.totalSteps} passed</li>`
    html += `<li><strong>Duration</strong>: ${duration}</li>`
    if (activeRun.totalTokens) {
      html += `<li><strong>Tokens Used</strong>: ${activeRun.totalTokens}</li>`
    }
    if (activeRun.inferenceTimeMs) {
      html += `<li><strong>Inference Time</strong>: ${(activeRun.inferenceTimeMs / 1000).toFixed(1)}s</li>`
    }
    html += `</ul>`
    
    if (activeRun.status === 'FAILED') {
      html += `<h2>Execution Failure Context</h2>`
      if (activeRun.errorMessage) {
        html += `<p><strong>Error Message</strong>: <code>${activeRun.errorMessage}</code></p>`
      }
      
      html += `<h3>How to Reproduce</h3>`
      html += `<p>This error occurred under the <strong>${activeRun.browserEnv ?? 'LOCAL'}</strong> browser environment. To reproduce this failure:</p>`
      html += `<ol>`
      if (test.startUrl) {
        html += `<li>Navigate to the start URL: <code>${test.startUrl}</code></li>`
      } else if (project?.baseUrl) {
        html += `<li>Navigate to the project base URL: <code>${project.baseUrl}</code></li>`
      }
      
      let foundFailure = false
      stepsList.forEach((step, idx) => {
        if (foundFailure) return
        if (step.result === 'FAILED') {
          html += `<li><strong>Failed Step (Step ${idx + 1})</strong>: <code>${step.instruction}</code> (Error: <em>${step.errorMessage ?? 'Unknown error'}</em>)</li>`
          foundFailure = true
        } else {
          html += `<li>Execute step ${idx + 1}: <code>${step.instruction}</code></li>`
        }
      })
      html += `</ol>`
    }
    
    html += `<h2>Steps Execution</h2>`
    
    if (stepsList.length === 0) {
      html += `<p><em>No steps recorded.</em></p>`
    } else {
      html += `<table>`
      html += `<thead>`
      html += `<tr><th>#</th><th>Instruction</th><th>Result</th><th>Duration</th><th>Error Message</th></tr>`
      html += `</thead>`
      html += `<tbody>`
      stepsList.forEach((step) => {
        const stepDuration = (step.durationMs / 1000).toFixed(1) + 's'
        const error = step.errorMessage ? step.errorMessage : ''
        html += `<tr>`
        html += `<td>${step.stepIndex + 1}</td>`
        html += `<td>${step.instruction}</td>`
        html += `<td><strong>${step.result}</strong></td>`
        html += `<td>${stepDuration}</td>`
        html += `<td>${error}</td>`
        html += `</tr>`
      })
      html += `</tbody>`
      html += `</table>`
    }
    
    return html
  }

  async function downloadReport() {
    if (!editor) return
    const mdContent = await editor.blocksToMarkdownLossy(editor.document)
    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `test-report-${test?.id}-${activeRun?.id}.md`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  async function copyToClipboard() {
    if (!editor) return
    const mdContent = await editor.blocksToMarkdownLossy(editor.document)
    navigator.clipboard.writeText(mdContent).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showCloseButton={false} className="!h-[95vh] sm:max-w-none flex flex-col mx-5 rounded-lg p-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border pb-4 mb-4 shrink-0">
          <div>
            <SheetTitle className="text-lg font-semibold">Test Execution Report</SheetTitle>
            <p className="text-xs text-muted-foreground">View and edit rich test execution results</p>
          </div>
          <div className="flex items-center gap-1.5">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={copyToClipboard}>
                    {copied ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 animate-in fade-in zoom-in duration-200"><polyline points="20 6 9 17 4 12"/></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{copied ? 'Copied!' : 'Copy markdown'}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={downloadReport}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Download report (.md)</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Close report</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <div 
          className="flex-1 overflow-y-auto min-h-0 border border-border rounded-md bg-card p-4 bn-editor-container
            [&_.bn-editor]:!p-6 [&_.bn-editor]:!pl-14
            [&_.bn-root]:!font-sans [&_.bn-root_*]:!font-sans [&_.bn-editor]:!font-sans [&_.bn-editor_*]:!font-sans
            [&_.bn-root]:!bg-transparent [--bn-colors-editor-background:transparent]"
        >
          {editor && (
            <BlockNoteView
              editor={editor}
              theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
              shadCNComponents={blockNoteShadcnComponents as any}
              sideMenu={false}
            >
              <SideMenuController sideMenu={CustomSideMenu} />
            </BlockNoteView>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
