"use client"

import { useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { api } from "@/lib/api"
import { Button } from "@iris/ui/components/animate-ui/components/buttons/button"
import { Checkbox } from "@iris/ui/components/animate-ui/components/radix/checkbox"
import { Input } from "@iris/ui/components/input"
import { Label } from "@iris/ui/components/label"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@iris/ui/components/sheet"

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  value: z.string().min(1, "Value is required"),
  isSecret: z.boolean(),
})
type CreateValues = z.infer<typeof createSchema>

/** Quick-create sheet for a workspace variable; reports the created name back. */
export function VariableCreateSheet({
  open,
  onOpenChange,
  initialName,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialName: string
  onCreated: (name: string) => void
}) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    mode: "onBlur",
    defaultValues: { name: "", value: "", isSecret: false },
  })

  const isSecret = watch("isSecret")

  useEffect(() => {
    if (open) reset({ name: initialName, value: "", isSecret: false })
  }, [open, initialName, reset])

  async function onCreateSubmit(values: CreateValues) {
    try {
      await api.post("/workspace/variables", {
        name: values.name.trim(),
        value: values.value.trim(),
        isSecret: values.isSecret,
      })
      onOpenChange(false)
      onCreated(values.name.trim())
    } catch (err) {
      setError("root", {
        message:
          err instanceof Error ? err.message : "Failed to create variable",
      })
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onOpenChange(false)
      }}
    >
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Create variable</SheetTitle>
          <SheetDescription>
            Add a new workspace variable. Use{" "}
            <code className="rounded bg-muted px-1 text-xs">{"{{name}}"}</code>{" "}
            to reference it in any step.
          </SheetDescription>
        </SheetHeader>
        <form
          onSubmit={handleSubmit(onCreateSubmit)}
          className="mt-6 space-y-4 px-1"
        >
          <div className="space-y-1">
            <Label htmlFor="create-var-name" className="text-xs">
              Name
            </Label>
            <Input
              id="create-var-name"
              {...register("name")}
              placeholder="email"
              className="font-mono text-xs"
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="create-var-value" className="text-xs">
              Value
            </Label>
            <Input
              id="create-var-value"
              {...register("value")}
              type={isSecret ? "password" : "text"}
              placeholder={isSecret ? "••••••••" : "test@example.com"}
              className="text-xs"
            />
            {errors.value && (
              <p className="text-xs text-destructive">{errors.value.message}</p>
            )}
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
            <Controller
              control={control}
              name="isSecret"
              render={({ field }) => (
                <Checkbox
                  size="sm"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            Mark as secret
          </label>
          {errors.root && (
            <p className="text-xs text-destructive">{errors.root.message}</p>
          )}
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create & insert"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
