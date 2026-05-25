'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import type { WorkspaceVariable } from '@/lib/types';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Badge } from '@workspace/ui/components/badge';
import { Label } from '@workspace/ui/components/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@workspace/ui/components/card';

// ─── Edit row ───────────────────────────────────────────────────────────────────

const editSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  value: z.string().optional(),
  isSecret: z.boolean(),
})
type EditValues = z.infer<typeof editSchema>

function EditVariableRow({
  variable,
  onSave,
  onCancel,
}: {
  variable: WorkspaceVariable;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    mode: 'onBlur',
    defaultValues: { name: variable.name, value: '', isSecret: variable.isSecret },
  });

  const isSecret = watch('isSecret');

  async function onSubmit(values: EditValues) {
    const payload: Record<string, unknown> = { name: values.name, isSecret: values.isSecret };
    if (values.value) payload.value = values.value;
    await api.patch(`/workspace/variables/${variable.id}`, payload);
    onSave();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            {...register('name')}
            placeholder="name"
            className="font-mono text-xs"
          />
          {errors.name && <p className="text-xs text-destructive mt-0.5">{errors.name.message}</p>}
        </div>
        <Input
          {...register('value')}
          type={isSecret ? 'password' : 'text'}
          placeholder={variable.isSecret ? 'New value (leave blank to keep current)' : 'value'}
          className="flex-1 text-xs"
        />
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
          <input type="checkbox" {...register('isSecret')} className="accent-primary" />
          Secret
        </label>
        <div className="flex gap-2">
          <Button size="xs" type="submit">Save</Button>
          <Button size="xs" variant="ghost" type="button" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </form>
  );
}

// ─── Create form ────────────────────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  value: z.string().min(1, 'Value is required'),
  isSecret: z.boolean(),
})
type CreateValues = z.infer<typeof createSchema>

// ─── Main component ─────────────────────────────────────────────────────────────

interface Props {
  variables: WorkspaceVariable[];
  onUpdate: () => void;
}

export function VariableList({ variables, onUpdate }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const { register, handleSubmit, reset, watch, setError, formState: { errors, isSubmitting } } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    mode: 'onBlur',
    defaultValues: { name: '', value: '', isSecret: false },
  });

  const isSecretWatch = watch('isSecret');

  async function onCreate(values: CreateValues) {
    try {
      await api.post('/workspace/variables', values);
      reset();
      onUpdate();
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : 'Failed to add variable' });
    }
  }

  async function handleDelete(varId: string) {
    await api.delete(`/workspace/variables/${varId}`);
    onUpdate();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Workspace variables</CardTitle>
          <CardDescription>
            Reference variables in any test step using <code className="text-xs bg-muted px-1 py-0.5 rounded">{'{{variableName}}'}</code>.
            Shared across all projects. Secret values are never logged.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {variables.length === 0 ? (
            <p className="px-4 py-6 text-xs text-muted-foreground text-center">No variables yet</p>
          ) : (
            variables.map((v, i) => (
              <div
                key={v.id}
                className={`px-4 py-3${i > 0 ? ' border-t border-border' : ''}`}
              >
                {editingId === v.id ? (
                  <EditVariableRow
                    variable={v}
                    onSave={() => { setEditingId(null); onUpdate(); }}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <code className="text-xs font-mono font-medium text-foreground shrink-0">{v.name}</code>
                      {v.isSecret ? (
                        <Badge variant="secondary">secret</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground font-mono truncate">{v.value}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="xs" variant="ghost" onClick={() => setEditingId(v.id)}>Edit</Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => handleDelete(v.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add variable</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onCreate)} className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="var-name" className="text-xs">Name</Label>
                <Input
                  id="var-name"
                  {...register('name')}
                  placeholder="email"
                  className="font-mono text-xs"
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="flex-1 space-y-1">
                <Label htmlFor="var-value" className="text-xs">Value</Label>
                <Input
                  id="var-value"
                  {...register('value')}
                  type={isSecretWatch ? 'password' : 'text'}
                  placeholder={isSecretWatch ? '••••••••' : 'test@example.com'}
                  className="text-xs"
                />
                {errors.value && <p className="text-xs text-destructive">{errors.value.message}</p>}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                <input type="checkbox" {...register('isSecret')} className="accent-primary" />
                Mark as secret
              </label>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? 'Adding...' : 'Add variable'}
              </Button>
            </div>
            {errors.root && <p className="text-xs text-destructive">{errors.root.message}</p>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
