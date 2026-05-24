'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ROUTES } from '@/lib/routes';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Textarea } from '@workspace/ui/components/textarea';
import { Label } from '@workspace/ui/components/label';
import { Card, CardContent } from '@workspace/ui/components/card';
import { Separator } from '@workspace/ui/components/separator';
import { SidebarTrigger } from '@workspace/ui/components/sidebar';

export default function NewProjectPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', baseUrl: '', description: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const project = await api.post<{ id: string }>('/projects', form);
      router.push(ROUTES.project(project.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
      setLoading(false);
    }
  }

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <nav className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href={ROUTES.dashboard} className="hover:text-foreground transition-colors">
            Projects
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">New project</span>
        </nav>
      </header>

      <div className="p-6 max-w-2xl">
        <h1 className="text-2xl font-semibold text-foreground mb-8">Create a project</h1>

        <Card>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5 pt-2">
              <div className="space-y-1">
                <Label htmlFor="name">
                  Project name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  type="text"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  required
                  placeholder="My E-commerce App"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="baseUrl">
                  Base URL <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="baseUrl"
                  type="url"
                  value={form.baseUrl}
                  onChange={(e) => set('baseUrl', e.target.value)}
                  required
                  placeholder="https://myapp.com"
                />
                <p className="text-xs text-muted-foreground">
                  The root URL of the app being tested
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="description">
                  Description{' '}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder="What are you testing?"
                />
              </div>

              {error && (
                <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button variant="ghost" asChild>
                  <Link href={ROUTES.dashboard}>Cancel</Link>
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Creating...' : 'Create project'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
