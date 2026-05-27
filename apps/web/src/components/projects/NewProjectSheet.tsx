'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Textarea } from '@workspace/ui/components/textarea';
import { Label } from '@workspace/ui/components/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@workspace/ui/components/animate-ui/components/radix/dialog';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  baseUrl: z.string().min(1, 'Base URL is required').url('Enter a valid URL'),
  description: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

export function NewProjectSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (projectId: string) => void
}) {
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema as any),
    mode: 'onBlur',
  });

  async function onSubmit(values: FormValues) {
    try {
      const project = await api.post<{ id: string }>('/projects', values);
      reset();
      onCreated(project.id);
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : 'Failed to create project' });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>Set up a project to start running AI-powered tests.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="np-name">Project name <span className="text-destructive">*</span></Label>
            <Input id="np-name" placeholder="My App" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="np-url">Base URL <span className="text-destructive">*</span></Label>
            <Input id="np-url" placeholder="https://myapp.com" {...register('baseUrl')} />
            {errors.baseUrl && <p className="text-xs text-destructive">{errors.baseUrl.message}</p>}
            <p className="text-xs text-muted-foreground">The root URL of the app being tested</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="np-desc">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea id="np-desc" placeholder="What are you testing?" {...register('description')} />
          </div>

          {errors.root && (
            <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {errors.root.message}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
