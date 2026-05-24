'use client'

import { useState } from 'react'
import { TestStep } from '@/lib/types'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Textarea } from '@workspace/ui/components/textarea'

interface LocalStep {
  _key: string
  id?: string
  stepIndex: number
  instruction: string
  description: string
}

interface Props {
  test: { id: string }
  steps: TestStep[]
  onSave: (steps: Omit<LocalStep, '_key'>[]) => Promise<void>
}

export function StepEditor({ steps: initialSteps, onSave }: Props) {
  const [steps, setSteps] = useState<LocalStep[]>(
    initialSteps.map((s) => ({
      _key: s.id,
      id: s.id,
      stepIndex: s.stepIndex,
      instruction: s.instruction,
      description: s.description ?? '',
    }))
  )
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  function addStep() {
    setSteps((prev) => [
      ...prev,
      { _key: `new-${Date.now()}`, stepIndex: prev.length, instruction: '', description: '' },
    ])
    setDirty(true)
  }

  function update(key: string, patch: Partial<LocalStep>) {
    setSteps((prev) => prev.map((s) => s._key === key ? { ...s, ...patch } : s))
    setDirty(true)
  }

  function remove(key: string) {
    setSteps((prev) =>
      prev.filter((s) => s._key !== key).map((s, i) => ({ ...s, stepIndex: i }))
    )
    setDirty(true)
  }

  function move(key: string, dir: 'up' | 'down') {
    const idx = steps.findIndex((s) => s._key === key)
    if (idx === -1) return
    if (dir === 'up' && idx === 0) return
    if (dir === 'down' && idx === steps.length - 1) return
    const next = [...steps]
    const a = next[idx]
    const b = next[dir === 'up' ? idx - 1 : idx + 1]
    if (!a || !b) return
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    next[idx] = b
    next[swapIdx] = a
    setSteps(next.map((s, i) => ({ ...s, stepIndex: i })))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    try {
      await onSave(steps.map(({ _key, ...s }) => s))
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {dirty && (
        <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3">
          <p className="text-sm text-muted-foreground">Unsaved changes</p>
          <Button onClick={save} disabled={saving} size="sm">
            {saving ? 'Saving...' : 'Save steps'}
          </Button>
        </div>
      )}

      {steps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-xl bg-card">
          <p className="text-muted-foreground text-sm mb-4">No steps yet</p>
          <Button onClick={addStep} size="sm">+ Add first step</Button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {steps.map((step, idx) => (
              <div key={step._key} className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 bg-muted rounded-lg flex items-center justify-center
                                  text-xs font-mono text-muted-foreground shrink-0 mt-1">
                    {idx + 1}
                  </div>

                  <div className="flex-1 space-y-2">
                    <Input
                      value={step.description}
                      onChange={(e) => update(step._key, { description: e.target.value })}
                      placeholder="Step label (optional)"
                    />
                    <Textarea
                      value={step.instruction}
                      onChange={(e) => update(step._key, { instruction: e.target.value })}
                      placeholder='Plain English instruction, e.g. "Click the Sign In button"'
                      rows={2}
                      className="resize-none font-mono text-sm"
                    />
                  </div>

                  <div className="flex flex-col gap-0.5 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => move(step._key, 'up')}
                      disabled={idx === 0} className="h-7 w-7 text-xs">
                      ▲
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => move(step._key, 'down')}
                      disabled={idx === steps.length - 1} className="h-7 w-7 text-xs">
                      ▼
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(step._key)}
                      className="h-7 w-7 text-xs text-destructive hover:text-destructive">
                      ✕
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button variant="outline" onClick={addStep} className="w-full border-dashed">
            + Add step
          </Button>
        </>
      )}
    </div>
  )
}
