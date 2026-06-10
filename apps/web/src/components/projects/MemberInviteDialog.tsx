"use client"

import { useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { api } from "@/lib/api"
import { ROUTES } from "@/lib/routes"
import { ASSIGNABLE_PROJECT_ROLES } from "@iris/common"
import { Button } from "@iris/ui/components/animate-ui/components/buttons/button"
import { Input } from "@iris/ui/components/input"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@iris/ui/components/animate-ui/components/radix/dialog"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@iris/ui/components/animate-ui/components/radix/dropdown-menu"

const schema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  role: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"] as const),
})
type FormValues = z.infer<typeof schema>

/** "Invite member" button + dialog with email/role form. */
export function MemberInviteDialog({
  projectId,
  onInvited,
}: {
  projectId: string
  onInvited: () => void
}) {
  const [open, setOpen] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema as never),
    mode: "onBlur",
    defaultValues: { email: "", role: "MEMBER" },
  })

  async function onSubmit(values: FormValues) {
    try {
      await api.post(`${ROUTES.project(projectId)}/members`, {
        email: values.email,
        role: values.role,
      })
      setOpen(false)
      reset()
      onInvited()
    } catch (err) {
      setError("root", {
        message: err instanceof Error ? err.message : "Failed to invite member",
      })
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">Invite member</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite member</DialogTitle>
        </DialogHeader>
        <form
          id="invite-form"
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <div className="space-y-1">
            <Input
              type="email"
              placeholder="colleague@company.com"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start font-normal capitalize"
                  >
                    {field.value.toLowerCase()}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48">
                  <DropdownMenuRadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
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
            )}
          />
          {errors.root && (
            <p className="text-xs text-destructive">{errors.root.message}</p>
          )}
        </form>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button type="submit" form="invite-form" disabled={isSubmitting}>
            {isSubmitting ? "Inviting..." : "Send invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
