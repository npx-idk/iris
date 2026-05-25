'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { ROUTES } from '@/lib/routes';
import type { ProjectMember } from '@/lib/types';
import { ASSIGNABLE_PROJECT_ROLES, type AssignableProjectRole } from '@iris/common';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] as const),
})
type FormValues = z.infer<typeof schema>

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
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: { email: '', role: 'MEMBER' },
  });

  async function onSubmit(values: FormValues) {
    try {
      await api.post(`${ROUTES.project(projectId)}/members`, { email: values.email, role: values.role });
      reset();
      onUpdate();
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : 'Failed to invite member' });
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
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="colleague@company.com"
                  className="flex-1"
                  {...register('email')}
                />
                <select
                  {...register('role')}
                  className="h-7 rounded-md border border-input bg-card px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  {ASSIGNABLE_PROJECT_ROLES.map((r) => (
                    <option key={r} value={r}>{r.toLowerCase()}</option>
                  ))}
                </select>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Inviting...' : 'Invite'}
                </Button>
              </div>
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
              {errors.root && <p className="text-xs text-destructive mt-1">{errors.root.message}</p>}
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
