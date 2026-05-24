'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { ROUTES } from '@/lib/routes';
import { API_KEY_ROLE_BADGE_VARIANT } from '@/lib/roles';
import type { ApiKey } from '@/lib/types';
import { API_KEY_ROLES, type ApiKeyRole } from '@iris/common';
import { Button } from '@workspace/ui/components/button';
import { Badge } from '@workspace/ui/components/badge';
import { Input } from '@workspace/ui/components/input';
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card';

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
  const [name, setName] = useState('');
  const [role, setRole] = useState<ApiKeyRole>('CI');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const key = await api.post<ApiKey>(`${ROUTES.project(projectId)}/api-keys`, { name, role });
      setNewKey(key.raw!);
      setName('');
      onUpdate();
    } finally {
      setCreating(false);
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
            <p className="text-xs font-medium text-foreground">
              API key created — copy it now
            </p>
            <p className="text-xs text-muted-foreground">
              This key will never be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted rounded-md px-3 py-2 text-xs font-mono text-foreground break-all">
                {newKey}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <Button variant="ghost" size="xs" onClick={() => setNewKey(null)}>
              I&apos;ve saved it, dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Create API key</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate}>
            <div className="flex gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="CI Pipeline"
                className="flex-1"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as ApiKeyRole)}
                className="h-7 rounded-md border border-input bg-card px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                {API_KEY_ROLES.map((r) => (
                  <option key={r} value={r}>{API_KEY_ROLE_LABEL[r]}</option>
                ))}
              </select>
              <Button type="submit" disabled={creating}>
                {creating ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        {apiKeys.length === 0 ? (
          <CardContent>
            <p className="py-6 text-xs text-muted-foreground text-center">
              No API keys yet
            </p>
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
                  <code className="text-xs text-muted-foreground font-mono">
                    {key.keyPrefix}••••••••
                  </code>
                  <Badge variant={API_KEY_ROLE_BADGE_VARIANT[key.role]}>
                    {key.role}
                  </Badge>
                  {key.lastUsedAt && (
                    <span className="text-xs text-muted-foreground">
                      Last used {new Date(key.lastUsedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => handleRevoke(key.id)}
                className="text-destructive hover:text-destructive"
              >
                Revoke
              </Button>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
