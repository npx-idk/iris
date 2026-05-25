'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Textarea } from '@workspace/ui/components/textarea'
import { Label } from '@workspace/ui/components/label'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Separator } from '@workspace/ui/components/separator'
import { SidebarTrigger } from '@workspace/ui/components/sidebar'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  startUrl: z.string()
    .refine((v) => !v || /^https?:\/\/.+/.test(v), 'Enter a valid URL starting with http:// or https://')
    .optional(),
  tags: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

export default function NewTestPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const router = useRouter()
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
  })

  async function onSubmit(values: FormValues) {
    try {
      const tags = values.tags?.split(',').map((t) => t.trim()).filter(Boolean) ?? []
      const test = await api.post<{ id: string }>(`/projects/${projectId}/tests`, {
        name: values.name,
        description: values.description || undefined,
        startUrl: values.startUrl || undefined,
        tags,
      })
      router.push(ROUTES.test(test.id))
    } catch (err: any) {
      setError('root', { message: err.message ?? 'Failed to create test' })
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
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="test-name">Name *</Label>
                <Input id="test-name" placeholder="Login flow" {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-1">
                <Label htmlFor="test-desc">Description</Label>
                <Textarea id="test-desc" placeholder="What does this test verify?" {...register('description')} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="test-url">Start URL</Label>
                <Input
                  id="test-url"
                  placeholder="https://example.com/login (overrides project base URL)"
                  {...register('startUrl')}
                />
                {errors.startUrl && <p className="text-xs text-destructive">{errors.startUrl.message}</p>}
              </div>

              <div className="space-y-1">
                <Label htmlFor="test-tags">Tags</Label>
                <Input
                  id="test-tags"
                  placeholder="smoke, auth, critical (comma-separated)"
                  {...register('tags')}
                />
              </div>

              {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}

              <div className="flex justify-end gap-3">
                <Button type="button" variant="ghost" asChild>
                  <Link href={ROUTES.projectTests(projectId)}>Cancel</Link>
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create test'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
