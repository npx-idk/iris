'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Textarea } from '@workspace/ui/components/textarea'
import { Label } from '@workspace/ui/components/label'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Separator } from '@workspace/ui/components/separator'
import { SidebarTrigger } from '@workspace/ui/components/sidebar'

export default function NewTestPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const router = useRouter()
  const [form, setForm] = useState({ name: '', description: '', startUrl: '', tags: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean)
      const test = await api.post<{ id: string }>(`/projects/${projectId}/tests`, {
        name: form.name,
        description: form.description || undefined,
        startUrl: form.startUrl || undefined,
        tags,
      })
      router.push(ROUTES.test(test.id))
    } catch (err: any) {
      setError(err.message ?? 'Failed to create test')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <nav className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href={ROUTES.projectTests(projectId)} className="hover:text-foreground transition-colors">
            Tests
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">New test</span>
        </nav>
      </header>

      <div className="p-6 max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle>Create test</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="test-name">Name *</Label>
                <Input
                  id="test-name"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Login flow"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="test-desc">Description</Label>
                <Textarea
                  id="test-desc"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="What does this test verify?"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="test-url">Start URL</Label>
                <Input
                  id="test-url"
                  value={form.startUrl}
                  onChange={(e) => setForm((f) => ({ ...f, startUrl: e.target.value }))}
                  placeholder="https://example.com/login (overrides project base URL)"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="test-tags">Tags</Label>
                <Input
                  id="test-tags"
                  value={form.tags}
                  onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                  placeholder="smoke, auth, critical (comma-separated)"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex justify-end gap-3">
                <Button type="button" variant="ghost" asChild>
                  <Link href={ROUTES.projectTests(projectId)}>Cancel</Link>
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Creating...' : 'Create test'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
