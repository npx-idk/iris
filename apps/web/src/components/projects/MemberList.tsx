'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { ROUTES } from '@/lib/routes';
import type { ProjectMember } from '@/lib/types';
import { ASSIGNABLE_PROJECT_ROLES, type AssignableProjectRole } from '@iris/common';
import { Button } from '@iris/ui/components/animate-ui/components/buttons/button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Input } from '@iris/ui/components/input';
import { Card, CardHeader, CardTitle, CardAction } from '@iris/ui/components/card';
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader,
  DialogTitle, DialogFooter, DialogClose,
} from '@iris/ui/components/animate-ui/components/radix/dialog';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from '@iris/ui/components/animate-ui/components/radix/dropdown-menu';

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
  const [open, setOpen] = useState(false);

  const { register, handleSubmit, reset, control, setError, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema as any),
    mode: 'onBlur',
    defaultValues: { email: '', role: 'MEMBER' },
  });

  async function onSubmit(values: FormValues) {
    try {
      await api.post(`${ROUTES.project(projectId)}/members`, { email: values.email, role: values.role });
      setOpen(false);
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
    <Card>
      {canManage && (
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardAction>
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
              <DialogTrigger asChild>
                <Button size="sm">Invite member</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite member</DialogTitle>
                </DialogHeader>
                <form id="invite-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-1">
                    <Input
                      type="email"
                      placeholder="colleague@company.com"
                      {...register('email')}
                    />
                    {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                  </div>
                  <Controller
                    control={control}
                    name="role"
                    render={({ field }) => (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full justify-start font-normal capitalize">
                            {field.value.toLowerCase()}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-48">
                          <DropdownMenuRadioGroup value={field.value} onValueChange={field.onChange}>
                            {ASSIGNABLE_PROJECT_ROLES.map((r) => (
                              <DropdownMenuRadioItem key={r} value={r} className="capitalize">{r.toLowerCase()}</DropdownMenuRadioItem>
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
                  <Button type="submit" form="invite-form" disabled={isSubmitting}>
                    {isSubmitting ? 'Inviting...' : 'Send invite'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardAction>
        </CardHeader>
      )}
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-6 text-xs font-normal capitalize">
                    {member.role.toLowerCase()}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-36">
                  <DropdownMenuRadioGroup
                    value={member.role}
                    onValueChange={(v) => handleRoleChange(member.id, v as AssignableProjectRole)}
                  >
                    {ASSIGNABLE_PROJECT_ROLES.map((r) => (
                      <DropdownMenuRadioItem key={r} value={r} className="capitalize">{r.toLowerCase()}</DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <span className="text-xs text-muted-foreground capitalize">{member.role.toLowerCase()}</span>
            )}
            {canManage && member.role !== 'OWNER' && (
              <ConfirmDialog
                title="Remove member?"
                description={`${member.user.name} will lose access to this project.`}
                confirmLabel="Yes, remove"
                onConfirm={() => handleRemove(member.id)}
                trigger={<Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Remove</Button>}
              />
            )}
          </div>
        </div>
      ))}
    </Card>
  );
}
