'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Test } from '@/lib/types'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Textarea } from '@workspace/ui/components/textarea'
import { Label } from '@workspace/ui/components/label'
import { Badge } from '@workspace/ui/components/badge'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@workspace/ui/components/sheet'

interface GeneratedStep {
  stepIndex: number
  instruction: string
}

interface GeneratedTest {
  name: string
  description: string
  startUrl: string
  steps: GeneratedStep[]
}

interface ExploreResult {
  pagePurpose: string
  tests: GeneratedTest[]
}

type Phase = 'input' | 'loading' | 'review'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  defaultUrl: string
  onSaved: () => void
}

export function GenerateTestsSheet({ open, onOpenChange, projectId, defaultUrl, onSaved }: Props) {
  const [phase, setPhase] = useState<Phase>('input')
  const [url, setUrl] = useState('')
  const [context, setContext] = useState('')
  const [prerequisiteTestId, setPrerequisiteTestId] = useState<string>('')
  const [result, setResult] = useState<ExploreResult | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: tests = [] } = useQuery({
    queryKey: ['tests', projectId],
    queryFn: () => api.get<Test[]>(`/projects/${projectId}/tests`),
    enabled: open,
  })

  const selectedPrereq = tests.find((t) => t.id === prerequisiteTestId)

  function handleOpen(v: boolean) {
    if (v) {
      setPhase('input')
      setUrl(defaultUrl)
      setContext('')
      setPrerequisiteTestId('')
      setResult(null)
      setSelected(new Set())
      setError(null)
    }
    onOpenChange(v)
  }

  async function handleGenerate() {
    if (!url.trim()) return
    setError(null)
    setPhase('loading')
    try {
      const data = await api.post<ExploreResult>(`/projects/${projectId}/explore`, {
        url: url.trim(),
        context: context.trim() || undefined,
        prerequisiteTestId: prerequisiteTestId || undefined,
      })
      setResult(data)
      setSelected(new Set(data.tests.map((_, i) => i)))
      setPhase('review')
    } catch (err: any) {
      setError(err.message ?? 'Exploration failed')
      setPhase('input')
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
    } finally {
      setSaving(false)
    }
  }

  function toggleTest(i: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Generate tests with AI</SheetTitle>
          <SheetDescription>
            AI will explore the page, identify interactive elements, and generate test scenarios automatically.
          </SheetDescription>
        </SheetHeader>

        {phase === 'input' && (
          <div className="mt-6 space-y-4 px-1">
            <div className="space-y-1">
              <Label htmlFor="gen-url" className="text-xs">Page URL</Label>
              <Input
                id="gen-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/dashboard"
                className="text-xs"
              />
            </div>

            {/* Prerequisite test — for authenticated pages */}
            <div className="space-y-1">
              <Label htmlFor="gen-prereq" className="text-xs">
                Prerequisite test{' '}
                <span className="text-muted-foreground font-normal">(optional — for pages that require login)</span>
              </Label>
              <select
                id="gen-prereq"
                value={prerequisiteTestId}
                onChange={(e) => setPrerequisiteTestId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-card px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                <option value="">None — page is public</option>
                {tests.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {selectedPrereq && (
                <p className="text-xs text-muted-foreground mt-1">
                  AI will run <span className="font-medium text-foreground">{selectedPrereq.name}</span> first
                  ({selectedPrereq._count?.steps ?? 0} steps) to authenticate, then explore the target page.
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
                onChange={(e) => setContext(e.target.value)}
                placeholder="e.g. Dashboard showing analytics data. Focus on chart interactions and filters."
                className="text-xs resize-none min-h-[80px]"
              />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end">
              <Button onClick={handleGenerate} disabled={!url.trim()}>
                Generate
              </Button>
            </div>
          </div>
        )}

        {phase === 'loading' && (
          <div className="mt-16 flex flex-col items-center justify-center gap-4 text-center px-6">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">
              {selectedPrereq ? 'Authenticating, then exploring the page…' : 'AI is exploring the page…'}
            </p>
            <p className="text-xs text-muted-foreground/60">This usually takes 15–40 seconds</p>
          </div>
        )}

        {phase === 'review' && result && (
          <div className="mt-6 space-y-4 px-1">
            <p className="text-xs text-muted-foreground italic">{result.pagePurpose}</p>
            {selectedPrereq && (
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
                <span className="text-xs text-muted-foreground">Prerequisite:</span>
                <span className="text-xs font-medium text-foreground">{selectedPrereq.name}</span>
                <span className="text-xs text-muted-foreground">will be linked to each saved test</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Select the tests you want to save ({selected.size} of {result.tests.length} selected)
            </p>

            <div className="space-y-3">
              {result.tests.map((test, i) => (
                <TestReviewRow
                  key={i}
                  test={test}
                  checked={selected.has(i)}
                  onToggle={() => toggleTest(i)}
                />
              ))}
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={() => setPhase('input')}>
                ← Back
              </Button>
              <Button onClick={handleSave} disabled={saving || selected.size === 0}>
                {saving ? 'Saving…' : `Save ${selected.size} test${selected.size !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function TestReviewRow({
  test, checked, onToggle,
}: {
  test: GeneratedTest
  checked: boolean
  onToggle: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`rounded-lg border transition-colors ${checked ? 'border-ring bg-card' : 'border-border bg-muted/30'}`}>
      {/* Header row */}
      <div className="flex items-start gap-3 px-3 py-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 accent-primary shrink-0 cursor-pointer"
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 min-w-0 text-left"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <p className="text-sm font-medium text-card-foreground truncate">{test.name}</p>
              <Badge variant="outline" className="text-xs shrink-0">{test.steps.length} steps</Badge>
            </div>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={`shrink-0 text-muted-foreground transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
          {test.description && (
            <p className="text-xs text-muted-foreground mt-0.5 text-left line-clamp-2">{test.description}</p>
          )}
        </button>
      </div>

      {/* Steps accordion body */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-border">
          <ol className="mt-3 space-y-2">
            {test.steps.map((step) => (
              <li key={step.stepIndex} className="flex gap-2.5 text-xs">
                <span className="shrink-0 w-4 text-right text-muted-foreground/50 font-mono leading-relaxed">
                  {step.stepIndex + 1}.
                </span>
                <span className="text-muted-foreground leading-relaxed">{step.instruction}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
