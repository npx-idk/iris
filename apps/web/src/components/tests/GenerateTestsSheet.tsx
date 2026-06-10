"use client"

import { useState } from "react"
import { api } from "@/lib/api"
import { useProjectTests } from "@/hooks/queries"
import type { ExploreResult } from "@iris/agent"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@iris/ui/components/sheet"
import { GenerateTestsForm } from "./GenerateTestsForm"
import { GenerateTestsReview } from "./GenerateTestsReview"

type Phase = "input" | "loading" | "review"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  defaultUrl: string
  onSaved: () => void
}

/** AI test generation flow: input → explore (loading) → review & save. */
export function GenerateTestsSheet({
  open,
  onOpenChange,
  projectId,
  defaultUrl,
  onSaved,
}: Props) {
  const [phase, setPhase] = useState<Phase>("input")
  const [url, setUrl] = useState("")
  const [context, setContext] = useState("")
  const [prerequisiteTestId, setPrerequisiteTestId] = useState<string>("")
  const [result, setResult] = useState<ExploreResult | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: tests = [] } = useProjectTests(projectId, { enabled: open })

  const selectedPrereq = tests.find((t) => t.id === prerequisiteTestId)

  function handleOpen(v: boolean) {
    if (v) {
      setPhase("input")
      setUrl(defaultUrl)
      setContext("")
      setPrerequisiteTestId("")
      setResult(null)
      setSelected(new Set())
      setError(null)
    }
    onOpenChange(v)
  }

  async function handleGenerate() {
    if (!url.trim()) return
    setError(null)
    setPhase("loading")
    try {
      const data = await api.post<ExploreResult>(
        `/projects/${projectId}/explore`,
        {
          url: url.trim(),
          context: context.trim() || undefined,
          prerequisiteTestId: prerequisiteTestId || undefined,
        }
      )
      setResult(data)
      setSelected(new Set(data.tests.map((_, i) => i)))
      setPhase("review")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Exploration failed")
      setPhase("input")
    }
  }

  async function handleSave() {
    if (!result) return
    const testsToSave = result.tests
      .filter((_, i) => selected.has(i))
      .map((test) => ({
        ...test,
        // Wire the prerequisite so each saved test depends on it
        prerequisiteNames: selectedPrereq ? [selectedPrereq.name] : [],
      }))
    if (!testsToSave.length) return
    setSaving(true)
    try {
      await api.post(`/projects/${projectId}/import`, { tests: testsToSave })
      onSaved()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save tests")
    } finally {
      setSaving(false)
    }
  }

  function toggleTest(i: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Generate tests with AI</SheetTitle>
          <SheetDescription>
            AI will explore the page, identify interactive elements, and
            generate test scenarios automatically.
          </SheetDescription>
        </SheetHeader>

        {phase === "input" && (
          <GenerateTestsForm
            url={url}
            onUrlChange={setUrl}
            context={context}
            onContextChange={setContext}
            prerequisiteTestId={prerequisiteTestId}
            onPrerequisiteChange={setPrerequisiteTestId}
            tests={tests}
            selectedPrereq={selectedPrereq}
            error={error}
            onGenerate={handleGenerate}
          />
        )}

        {phase === "loading" && (
          <div className="mt-16 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">
              {selectedPrereq
                ? "Authenticating, then exploring the page…"
                : "AI is exploring the page…"}
            </p>
            <p className="text-xs text-muted-foreground/60">
              This usually takes 15–40 seconds
            </p>
          </div>
        )}

        {phase === "review" && result && (
          <GenerateTestsReview
            result={result}
            selectedPrereq={selectedPrereq}
            selected={selected}
            onToggle={toggleTest}
            error={error}
            saving={saving}
            onBack={() => setPhase("input")}
            onSave={handleSave}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
