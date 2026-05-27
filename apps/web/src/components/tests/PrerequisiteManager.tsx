'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { TestWithSteps, Test } from '@/lib/types'
import { Button } from '@workspace/ui/components/animate-ui/components/buttons/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from '@workspace/ui/components/animate-ui/components/radix/dropdown-menu'

interface Props {
  test: TestWithSteps
  onUpdate: () => void
}

export function PrerequisiteManager({ test, onUpdate }: Props) {
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState('')

  const { data: allTests = [] } = useQuery({
    queryKey: ['tests', test.projectId],
    queryFn: () => api.get<Test[]>(`/projects/${test.projectId}/tests`),
  })

  const eligible = allTests.filter(
    (t) => t.id !== test.id && !test.prerequisites.some((p) => p.id === t.id)
  )

  async function handleAdd() {
    if (!selectedId) return
    setError('')
    setAdding(true)
    try {
      await api.post(`/tests/${test.id}/prerequisites`, { prerequisiteId: selectedId })
      setSelectedId('')
      onUpdate()
    } catch (err: any) {
      setError(err.message ?? 'Failed to add prerequisite')
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
      <div className="bg-card border border-border rounded-xl px-4 py-3">
        <p className="text-sm font-medium text-card-foreground mb-1">How prerequisites work</p>
        <p className="text-sm text-muted-foreground">
          When you run this test, all prerequisite tests run first in order.
          If any prerequisite fails, this test is marked as failed without running.
        </p>
      </div>

      {eligible.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <p className="font-medium text-sm text-card-foreground mb-4">Add prerequisite</p>
            <div className="flex gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex-1 justify-start font-normal text-sm">
                    {selectedId
                      ? (eligible.find((t) => t.id === selectedId)?.name ?? 'Unknown test')
                      : 'Select a test...'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-72">
                  <DropdownMenuRadioGroup value={selectedId} onValueChange={setSelectedId}>
                    {eligible.map((t) => (
                      <DropdownMenuRadioItem key={t.id} value={t.id}>{t.name}</DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={handleAdd} disabled={!selectedId || adding} size="sm">
                {adding ? 'Adding...' : 'Add'}
              </Button>
            </div>
            {error && <p className="text-sm text-destructive mt-2">{error}</p>}
          </CardContent>
        </Card>
      )}

      <div className="bg-card rounded-xl border border-border divide-y divide-border">
        {test.prerequisites.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted-foreground text-center">
            No prerequisites — this test runs independently
          </p>
        ) : (
          test.prerequisites.map((prereq, idx) => (
            <div key={prereq.id} className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground w-5">{idx + 1}</span>
                <span className="text-sm font-medium text-card-foreground">{prereq.name}</span>
              </div>
              <Button variant="ghost" size="sm"
                onClick={() => handleRemove(prereq.id)}
                className="text-destructive hover:text-destructive text-xs">
                Remove
              </Button>
            </div>
          ))
        )}
      </div>

      {eligible.length === 0 && test.prerequisites.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Create more tests in this project to add prerequisites
        </p>
      )}
    </div>
  )
}
