"use client"

import { useState } from "react"
import { TestStep, WorkspaceVariable } from "@/lib/types"
import { SlashCommandMenu } from "./SlashCommandMenu"
import { Button } from "@iris/ui/components/animate-ui/components/buttons/button"

/** Inline edit form for a saved step's label + instruction. */
export function StepEditForm({
  step,
  projectVariables,
  onVariableCreated,
  onSave,
  onCancel,
}: {
  step: TestStep
  projectVariables: WorkspaceVariable[]
  onVariableCreated?: () => void
  onSave: (instruction: string, description: string) => void | Promise<void>
  onCancel: () => void
}) {
  const [instruction, setInstruction] = useState(step.instruction)
  const [description, setDescription] = useState(step.description ?? "")
  const [saving, setSaving] = useState(false)

  async function commit() {
    if (!instruction.trim()) return
    setSaving(true)
    try {
      await onSave(instruction.trim(), description.trim())
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-1 space-y-2 rounded-xl border border-ring bg-card px-4 py-3">
      <div className="flex items-center gap-2">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Label (optional)"
          className="flex-1 border-b border-border bg-transparent py-0.5 text-xs text-muted-foreground outline-none focus:border-ring"
        />
      </div>
      <SlashCommandMenu
        value={instruction}
        onChange={setInstruction}
        variables={projectVariables}
        onVariableCreated={onVariableCreated ?? (() => {})}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            commit()
          }
          if (e.key === "Escape") onCancel()
        }}
        className="min-h-[60px] resize-none text-sm"
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-6 text-xs"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={commit}
          disabled={saving || !instruction.trim()}
          className="h-6 text-xs"
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  )
}
