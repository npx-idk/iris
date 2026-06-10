"use client"

import type { Test } from "@/lib/types"
import { Button } from "@iris/ui/components/animate-ui/components/buttons/button"
import { Input } from "@iris/ui/components/input"
import { Textarea } from "@iris/ui/components/textarea"
import { Label } from "@iris/ui/components/label"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@iris/ui/components/animate-ui/components/radix/dropdown-menu"

/** Input phase of AI test generation: target URL, optional prerequisite + context. */
export function GenerateTestsForm({
  url,
  onUrlChange,
  context,
  onContextChange,
  prerequisiteTestId,
  onPrerequisiteChange,
  tests,
  selectedPrereq,
  error,
  onGenerate,
}: {
  url: string
  onUrlChange: (v: string) => void
  context: string
  onContextChange: (v: string) => void
  prerequisiteTestId: string
  onPrerequisiteChange: (v: string) => void
  tests: Test[]
  selectedPrereq: Test | undefined
  error: string | null
  onGenerate: () => void
}) {
  return (
    <div className="mt-6 space-y-4 px-1">
      <div className="space-y-1">
        <Label htmlFor="gen-url" className="text-xs">
          Page URL
        </Label>
        <Input
          id="gen-url"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="https://example.com/dashboard"
          className="text-xs"
        />
      </div>

      {/* Prerequisite test — for authenticated pages */}
      <div className="space-y-1">
        <Label htmlFor="gen-prereq" className="text-xs">
          Prerequisite test{" "}
          <span className="font-normal text-muted-foreground">
            (optional — for pages that require login)
          </span>
        </Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start text-xs font-normal"
            >
              {prerequisiteTestId
                ? (tests.find((t) => t.id === prerequisiteTestId)?.name ??
                  "Unknown test")
                : "None — page is public"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-72">
            <DropdownMenuRadioGroup
              value={prerequisiteTestId}
              onValueChange={onPrerequisiteChange}
            >
              <DropdownMenuRadioItem value="">
                None — page is public
              </DropdownMenuRadioItem>
              {tests.map((t) => (
                <DropdownMenuRadioItem key={t.id} value={t.id}>
                  {t.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {selectedPrereq && (
          <p className="mt-1 text-xs text-muted-foreground">
            AI will run{" "}
            <span className="font-medium text-foreground">
              {selectedPrereq.name}
            </span>{" "}
            first ({selectedPrereq._count?.steps ?? 0} steps) to authenticate,
            then explore the target page.
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="gen-ctx" className="text-xs">
          Context <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="gen-ctx"
          value={context}
          onChange={(e) => onContextChange(e.target.value)}
          placeholder="e.g. Dashboard showing analytics data. Focus on chart interactions and filters."
          className="min-h-[80px] resize-none text-xs"
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button onClick={onGenerate} disabled={!url.trim()}>
          Generate
        </Button>
      </div>
    </div>
  )
}
