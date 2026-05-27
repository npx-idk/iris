'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { ROUTES } from '@/lib/routes';
import { API_KEY_ROLE_BADGE_VARIANT } from '@/lib/roles';
import type { ApiKey } from '@/lib/types';
import { API_KEY_ROLES, type ApiKeyRole } from '@iris/common';
import { Button } from '@workspace/ui/components/animate-ui/components/buttons/button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Badge } from '@workspace/ui/components/badge';
import { Input } from '@workspace/ui/components/input';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@workspace/ui/components/card';
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader,
  DialogTitle, DialogFooter, DialogClose,
} from '@workspace/ui/components/animate-ui/components/radix/dialog';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from '@workspace/ui/components/animate-ui/components/radix/dropdown-menu';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  role: z.enum(['CI', 'ADMIN'] as const),
})
type FormValues = z.infer<typeof schema>

const API_KEY_ROLE_LABEL: Record<ApiKeyRole, string> = {
  CI: 'CI (trigger runs only)',
  ADMIN: 'Admin (full access)',
};

interface Props {
  apiKeys: ApiKey[];
  projectId: string;
  onUpdate: () => void;
}

export function ApiKeyList({ apiKeys, projectId, onUpdate }: Props) {
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const { register, handleSubmit, reset, control, setError, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema as any),
    mode: 'onBlur',
    defaultValues: { name: '', role: 'CI' },
  });

  async function onSubmit(values: FormValues) {
    try {
      const key = await api.post<ApiKey>(`${ROUTES.project(projectId)}/api-keys`, { name: values.name, role: values.role });
      setNewKey(key.raw!);
      setOpen(false);
      reset();
      onUpdate();
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : 'Failed to create API key' });
    }
  }

  async function handleRevoke(keyId: string) {
    await api.delete(`${ROUTES.project(projectId)}/api-keys/${keyId}`);
    onUpdate();
  }

  function handleCopy() {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="space-y-4">
      {newKey && (
        <Card className="ring-2 ring-ring/50">
          <CardContent className="space-y-3">
            <p className="text-xs font-medium text-foreground">API key created — copy it now</p>
            <p className="text-xs text-muted-foreground">This key will never be shown again.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted rounded-md px-3 py-2 text-xs font-mono text-foreground break-all">
                {newKey}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setNewKey(null)}>
              I&apos;ve saved it, dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>API keys</CardTitle>
          <CardAction>
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
              <DialogTrigger asChild>
                <Button size="sm">Create API key</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create API key</DialogTitle>
                </DialogHeader>
                <form id="api-key-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-1">
                    <Input placeholder="CI Pipeline" {...register('name')} />
                    {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                  </div>
                  <Controller
                    control={control}
                    name="role"
                    render={({ field }) => (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full justify-start font-normal">
                            {API_KEY_ROLE_LABEL[field.value]}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-64">
                          <DropdownMenuRadioGroup value={field.value} onValueChange={field.onChange}>
                            {API_KEY_ROLES.map((r) => (
                              <DropdownMenuRadioItem key={r} value={r}>{API_KEY_ROLE_LABEL[r]}</DropdownMenuRadioItem>
                            ))}
                          </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  />
                  {errors.root && <p className="text-xs text-destructive">{errors.root.message}</p>}
                </form>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="ghost">Cancel</Button>
                  </DialogClose>
                  <Button type="submit" form="api-key-form" disabled={isSubmitting}>
                    {isSubmitting ? 'Creating...' : 'Create'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardAction>
        </CardHeader>
        {apiKeys.length === 0 ? (
          <CardContent>
            <p className="py-6 text-xs text-muted-foreground text-center">No API keys yet</p>
          </CardContent>
        ) : (
          apiKeys.map((key, i) => (
            <div
              key={key.id}
              className={`flex items-center justify-between px-4 py-3${i > 0 ? ' border-t border-border' : ''}`}
            >
              <div>
                <p className="text-xs font-medium text-foreground">{key.name}</p>
                <div className="flex items-center gap-3 mt-1">
                  <code className="text-xs text-muted-foreground font-mono">{key.keyPrefix}••••••••</code>
                  <Badge variant={API_KEY_ROLE_BADGE_VARIANT[key.role]}>{key.role}</Badge>
                  {key.lastUsedAt && (
                    <span className="text-xs text-muted-foreground">
                      Last used {new Date(key.lastUsedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <ConfirmDialog
                title="Revoke API key?"
                description={`"${key.name}" will be permanently revoked. Any services using it will lose access.`}
                confirmLabel="Yes, revoke"
                onConfirm={() => handleRevoke(key.id)}
                trigger={<Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Revoke</Button>}
              />
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
