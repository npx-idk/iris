'use client'

import { arrayMove } from '@dnd-kit/sortable'
import { api } from '@/lib/api'
import { TestWithSteps, TestStep } from '@/lib/types'

export function useStepManagement(
  testId: string,
  test: TestWithSteps | undefined,
  refetch: () => void,
) {
  async function saveSteps(steps: TestStep[]) {
    await api.put(`/tests/${testId}/steps`, {
      steps: steps.map((s, i) => ({ id: s.id, stepIndex: i, instruction: s.instruction, description: s.description })),
    })
    refetch()
  }

  async function handleDeleteStep(stepId: string) {
    if (!test) return
    await saveSteps(test.steps.filter((s) => s.id !== stepId))
  }

  async function handleSaveStep(stepId: string, instruction: string, description: string) {
    if (!test) return
    await saveSteps(test.steps.map((s) => s.id === stepId ? { ...s, instruction, description } : s))
  }

  async function handleReorderSteps(activeId: string, overId: string) {
    if (!test || activeId === overId) return
    const steps = test.steps
    const oldIndex = steps.findIndex((s) => s.id === activeId)
    const newIndex = steps.findIndex((s) => s.id === overId)
    if (oldIndex === -1 || newIndex === -1) return
    await saveSteps(arrayMove(steps, oldIndex, newIndex))
  }

  return { handleDeleteStep, handleSaveStep, handleReorderSteps }
}
