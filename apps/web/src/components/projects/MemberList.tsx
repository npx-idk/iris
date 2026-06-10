"use client"

import { api } from "@/lib/api"
import { ROUTES } from "@/lib/routes"
import type { ProjectMember } from "@/lib/types"
import {
  ASSIGNABLE_PROJECT_ROLES,
  type AssignableProjectRole,
} from "@iris/common"
import { Button } from "@iris/ui/components/animate-ui/components/buttons/button"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
} from "@iris/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@iris/ui/components/animate-ui/components/radix/dropdown-menu"
import { MemberInviteDialog } from "./MemberInviteDialog"

interface Props {
  members: ProjectMember[]
  projectId: string
  canManage: boolean
  isOwner: boolean
  onUpdate: () => void
}

export function MemberList({
  members,
  projectId,
  canManage,
  isOwner,
  onUpdate,
}: Props) {
  async function handleRemove(memberId: string) {
    await api.delete(`${ROUTES.project(projectId)}/members/${memberId}`)
    onUpdate()
  }

  async function handleRoleChange(
    memberId: string,
    role: AssignableProjectRole
  ) {
    await api.patch(`${ROUTES.project(projectId)}/members/${memberId}`, {
      role,
    })
    onUpdate()
  }

  return (
    <Card>
      {canManage && (
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardAction>
            <MemberInviteDialog projectId={projectId} onInvited={onUpdate} />
          </CardAction>
        </CardHeader>
      )}
      {members.map((member, i) => (
        <div
          key={member.id}
          className={`flex items-center justify-between px-4 py-3${i > 0 ? "border-t border-border" : ""}`}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
              {member.user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-medium text-foreground">
                {member.user.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {member.user.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isOwner && member.role !== "OWNER" ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs font-normal capitalize"
                  >
                    {member.role.toLowerCase()}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-36">
                  <DropdownMenuRadioGroup
                    value={member.role}
                    onValueChange={(v) =>
                      handleRoleChange(member.id, v as AssignableProjectRole)
                    }
                  >
                    {ASSIGNABLE_PROJECT_ROLES.map((r) => (
                      <DropdownMenuRadioItem
                        key={r}
                        value={r}
                        className="capitalize"
                      >
                        {r.toLowerCase()}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <span className="text-xs text-muted-foreground capitalize">
                {member.role.toLowerCase()}
              </span>
            )}
            {canManage && member.role !== "OWNER" && (
              <ConfirmDialog
                title="Remove member?"
                description={`${member.user.name} will lose access to this project.`}
                confirmLabel="Yes, remove"
                onConfirm={() => handleRemove(member.id)}
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                  >
                    Remove
                  </Button>
                }
              />
            )}
          </div>
        </div>
      ))}
    </Card>
  )
}
