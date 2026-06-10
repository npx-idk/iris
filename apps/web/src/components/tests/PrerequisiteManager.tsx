"use client"

import { useState } from "react"
import { api } from "@/lib/api"
import { useProjectTests } from "@/hooks/queries"
import { TestWithSteps } from "@/lib/types"
import { Button } from "@iris/ui/components/animate-ui/components/buttons/button"
import { Card, CardContent } from "@iris/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@iris/ui/components/animate-ui/components/radix/dropdown-menu"

interface Props {
  test: TestWithSteps
  onUpdate: () => void
}

export function PrerequisiteManager({ test, onUpdate }: Props) {
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState("")
  const [selectedId, setSelectedId] = useState("")

  const { data: allTests = [] } = useProjectTests(test.projectId)

  const eligible = allTests.filter(
    (t) => t.id !== test.id && !test.prerequisites.some((p) => p.id === t.id)
  )

  async function handleAdd() {
    if (!selectedId) return
    setError("")
    setAdding(true)
    try {
      await api.post(`/tests/${test.id}/prerequisites`, {
        prerequisiteId: selectedId,
      })
      setSelectedId("")
      onUpdate()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to add prerequisite"
      )
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(prerequisiteId: string) {
    await api.delete(`/tests/${test.id}/prerequisites/${prerequisiteId}`)
    onUpdate()
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <p className="mb-1 text-sm font-medium text-card-foreground">
          How prerequisites work
        </p>
        <p className="text-sm text-muted-foreground">
          When you run this test, all prerequisite tests run first in order. If
          any prerequisite fails, this test is marked as failed without running.
        </p>
      </div>

      {eligible.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <p className="mb-4 text-sm font-medium text-card-foreground">
              Add prerequisite
            </p>
            <div className="flex gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex-1 justify-start text-sm font-normal"
                  >
                    {selectedId
                      ? (eligible.find((t) => t.id === selectedId)?.name ??
                        "Unknown test")
                      : "Select a test..."}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-72">
                  <DropdownMenuRadioGroup
                    value={selectedId}
                    onValueChange={setSelectedId}
                  >
                    {eligible.map((t) => (
                      <DropdownMenuRadioItem key={t.id} value={t.id}>
                        {t.name}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                onClick={handleAdd}
                disabled={!selectedId || adding}
                size="sm"
              >
                {adding ? "Adding..." : "Add"}
              </Button>
            </div>
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      )}

      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        {test.prerequisites.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            No prerequisites — this test runs independently
          </p>
        ) : (
          test.prerequisites.map((prereq, idx) => (
            <div
              key={prereq.id}
              className="flex items-center justify-between px-5 py-4"
            >
              <div className="flex items-center gap-3">
                <span className="w-5 font-mono text-xs text-muted-foreground">
                  {idx + 1}
                </span>
                <span className="text-sm font-medium text-card-foreground">
                  {prereq.name}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(prereq.id)}
                className="text-xs text-destructive hover:text-destructive"
              >
                Remove
              </Button>
            </div>
          ))
        )}
      </div>

      {eligible.length === 0 && test.prerequisites.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Create more tests in this project to add prerequisites
        </p>
      )}
    </div>
  )
}
