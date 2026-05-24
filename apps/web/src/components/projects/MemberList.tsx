'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { ROUTES } from '@/lib/routes';
import type { ProjectMember } from '@/lib/types';
import { ASSIGNABLE_PROJECT_ROLES, type AssignableProjectRole } from '@iris/common';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card';

interface Props {
  members: ProjectMember[];
  projectId: string;
  canManage: boolean;
  isOwner: boolean;
  currentUserId: string;
  onUpdate: () => void;
}

export function MemberList({
  members, projectId, canManage, isOwner, currentUserId, onUpdate,
}: Props) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<AssignableProjectRole>('MEMBER');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState('');

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInviting(true);
    try {
      await api.post(`${ROUTES.project(projectId)}/members`, { email: inviteEmail, role: inviteRole });
      setInviteEmail('');
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite member');
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(memberId: string) {
    await api.delete(`${ROUTES.project(projectId)}/members/${memberId}`);
    onUpdate();
  }

  async function handleRoleChange(memberId: string, role: AssignableProjectRole) {
    await api.patch(`${ROUTES.project(projectId)}/members/${memberId}`, { role });
    onUpdate();
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Invite member</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite}>
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  placeholder="colleague@company.com"
                  className="flex-1"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as AssignableProjectRole)}
                  className="h-7 rounded-md border border-input bg-card px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  {ASSIGNABLE_PROJECT_ROLES.map((r) => (
                    <option key={r} value={r}>{r.toLowerCase()}</option>
                  ))}
                </select>
                <Button type="submit" disabled={inviting}>
                  {inviting ? 'Inviting...' : 'Invite'}
                </Button>
              </div>
              {error && (
                <p className="text-xs text-destructive mt-2">{error}</p>
              )}
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        {members.map((member, i) => (
          <div
            key={member.id}
            className={`flex items-center justify-between px-4 py-3${i > 0 ? ' border-t border-border' : ''}`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-xs font-medium text-foreground">
                {member.user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-medium text-foreground">{member.user.name}</p>
                <p className="text-xs text-muted-foreground">{member.user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isOwner && member.role !== 'OWNER' ? (
                <select
                  value={member.role}
                  onChange={(e) => handleRoleChange(member.id, e.target.value as AssignableProjectRole)}
                  className="h-6 rounded-md border border-input bg-card px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  {ASSIGNABLE_PROJECT_ROLES.map((r) => (
                    <option key={r} value={r}>{r.toLowerCase()}</option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-muted-foreground capitalize">
                  {member.role.toLowerCase()}
                </span>
              )}
              {canManage && member.role !== 'OWNER' && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => handleRemove(member.id)}
                  className="text-destructive hover:text-destructive"
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
