'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import type { WorkspaceVariable } from '@/lib/types';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Badge } from '@workspace/ui/components/badge';
import { Label } from '@workspace/ui/components/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@workspace/ui/components/card';

interface Props {
  variables: WorkspaceVariable[];
  onUpdate: () => void;
}

export function VariableList({ variables, onUpdate }: Props) {
  const [form, setForm] = useState({ name: '', value: '', isSecret: false });
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', value: '', isSecret: false });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/workspace/variables', form);
      setForm({ name: '', value: '', isSecret: false });
      onUpdate();
    } finally {
      setCreating(false);
    }
  }

  function startEdit(v: WorkspaceVariable) {
    setEditingId(v.id);
    setEditForm({ name: v.name, value: '', isSecret: v.isSecret });
  }

  async function handleSaveEdit(varId: string) {
    const payload: Record<string, unknown> = { name: editForm.name, isSecret: editForm.isSecret };
    if (editForm.value) payload.value = editForm.value;
    await api.patch(`/workspace/variables/${varId}`, payload);
    setEditingId(null);
    onUpdate();
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
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Input
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="name"
                        className="flex-1 font-mono text-xs"
                      />
                      <Input
                        type={editForm.isSecret ? 'password' : 'text'}
                        value={editForm.value}
                        onChange={(e) => setEditForm((f) => ({ ...f, value: e.target.value }))}
                        placeholder={v.isSecret ? 'New value (leave blank to keep current)' : 'value'}
                        className="flex-1 text-xs"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={editForm.isSecret}
                          onChange={(e) => setEditForm((f) => ({ ...f, isSecret: e.target.checked }))}
                          className="accent-primary"
                        />
                        Secret
                      </label>
                      <div className="flex gap-2">
                        <Button size="xs" onClick={() => handleSaveEdit(v.id)}>Save</Button>
                        <Button size="xs" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                      </div>
                    </div>
                  </div>
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
                      <Button size="xs" variant="ghost" onClick={() => startEdit(v)}>Edit</Button>
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
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="var-name" className="text-xs">Name</Label>
                <Input
                  id="var-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="email"
                  className="font-mono text-xs"
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label htmlFor="var-value" className="text-xs">Value</Label>
                <Input
                  id="var-value"
                  type={form.isSecret ? 'password' : 'text'}
                  value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                  required
                  placeholder={form.isSecret ? '••••••••' : 'test@example.com'}
                  className="text-xs"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.isSecret}
                  onChange={(e) => setForm((f) => ({ ...f, isSecret: e.target.checked }))}
                  className="accent-primary"
                />
                Mark as secret
              </label>
              <Button type="submit" size="sm" disabled={creating}>
                {creating ? 'Adding...' : 'Add variable'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
