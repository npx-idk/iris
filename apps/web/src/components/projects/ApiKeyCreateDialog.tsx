"use client"

import { useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { api } from "@/lib/api"
import { ROUTES } from "@/lib/routes"
import type { ApiKey } from "@/lib/types"
import { API_KEY_ROLES, type ApiKeyRole } from "@iris/common"
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
  name: z.string().min(1, "Name is required"),
  role: z.enum(["CI", "ADMIN"] as const),
})
type FormValues = z.infer<typeof schema>

const API_KEY_ROLE_LABEL: Record<ApiKeyRole, string> = {
  CI: "CI (trigger runs only)",
  ADMIN: "Admin (full access)",
}

/** "Create API key" button + dialog; reports the raw key back exactly once. */
export function ApiKeyCreateDialog({
  projectId,
  onCreated,
}: {
  projectId: string
  onCreated: (rawKey: string) => void
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
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: { name: "", role: "CI" },
  })

  async function onSubmit(values: FormValues) {
    try {
      const key = await api.post<ApiKey>(
        `${ROUTES.project(projectId)}/api-keys`,
        { name: values.name, role: values.role }
      )
      setOpen(false)
      reset()
      onCreated(key.raw!)
    } catch (err) {
      setError("root", {
        message:
          err instanceof Error ? err.message : "Failed to create API key",
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
        <Button size="sm">Create API key</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create API key</DialogTitle>
        </DialogHeader>
        <form
          id="api-key-form"
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <div className="space-y-1">
            <Input placeholder="CI Pipeline" {...register("name")} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
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
                    className="w-full justify-start font-normal"
                  >
                    {API_KEY_ROLE_LABEL[field.value]}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64">
                  <DropdownMenuRadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    {API_KEY_ROLES.map((r) => (
                      <DropdownMenuRadioItem key={r} value={r}>
                        {API_KEY_ROLE_LABEL[r]}
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
          <Button type="submit" form="api-key-form" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
