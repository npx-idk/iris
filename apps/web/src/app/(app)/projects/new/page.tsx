'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { ROUTES } from '@/lib/routes';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Textarea } from '@workspace/ui/components/textarea';
import { Label } from '@workspace/ui/components/label';
import { Card, CardContent } from '@workspace/ui/components/card';
import { Separator } from '@workspace/ui/components/separator';
import { SidebarTrigger } from '@workspace/ui/components/sidebar';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  baseUrl: z.string().min(1, 'Base URL is required').url('Enter a valid URL (e.g. https://myapp.com)'),
  description: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

export default function NewProjectPage() {
  const router = useRouter();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
  });

  async function onSubmit(values: FormValues) {
    try {
      const project = await api.post<{ id: string }>('/projects', values);
      router.push(ROUTES.project(project.id));
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : 'Failed to create project' });
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
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pt-2">
              <div className="space-y-1">
                <Label htmlFor="name">
                  Project name <span className="text-destructive">*</span>
                </Label>
                <Input id="name" placeholder="My E-commerce App" {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-1">
                <Label htmlFor="baseUrl">
                  Base URL <span className="text-destructive">*</span>
                </Label>
                <Input id="baseUrl" placeholder="https://myapp.com" {...register('baseUrl')} />
                {errors.baseUrl && <p className="text-xs text-destructive">{errors.baseUrl.message}</p>}
                <p className="text-xs text-muted-foreground">The root URL of the app being tested</p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="description">
                  Description{' '}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea id="description" placeholder="What are you testing?" {...register('description')} />
              </div>

              {errors.root && (
                <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                  {errors.root.message}
                </p>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button variant="ghost" asChild>
                  <Link href={ROUTES.dashboard}>Cancel</Link>
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create project'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
