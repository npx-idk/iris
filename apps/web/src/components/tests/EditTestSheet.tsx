"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { api } from "@/lib/api"
import type { TestWithSteps } from "@/lib/types"
import { Button } from "@iris/ui/components/button"
import { Input } from "@iris/ui/components/input"
import { Textarea } from "@iris/ui/components/textarea"
import { Label } from "@iris/ui/components/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@iris/ui/components/animate-ui/components/radix/dialog"

const editSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  startUrl: z
    .string()
    .refine((v) => !v || /^https?:\/\/.+/.test(v), "Enter a valid URL")
    .optional(),
  tags: z.string().optional(),
})

type EditValues = z.infer<typeof editSchema>

interface EditTestSheetProps {
  test: TestWithSteps | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function EditTestSheet({
  test,
  open,
  onOpenChange,
  onSaved,
}: EditTestSheetProps) {
  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    mode: "onBlur",
  })

  useEffect(() => {
    if (open && test) {
      form.reset({
        name: test.name,
        description: test.description ?? "",
        startUrl: test.startUrl ?? "",
        tags: test.tags?.join(", ") ?? "",
      })
    }
  }, [open, test]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(values: EditValues) {
    const tags =
      values.tags
        ?.split(",")
        .map((t) => t.trim())
        .filter(Boolean) ?? []
    await api.patch(`/tests/${test?.id}`, {
      name: values.name,
      description: values.description || null,
      startUrl: values.startUrl || null,
      tags,
    })
    onOpenChange(false)
    onSaved()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) form.reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit test</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex flex-col gap-4 py-2"
        >
          <div className="space-y-1.5">
            <Label htmlFor="et-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input id="et-name" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="et-desc">
              Description{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Textarea
              id="et-desc"
              placeholder="What does this test verify?"
              {...form.register("description")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="et-url">
              Start URL{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Input
              id="et-url"
              placeholder="https://example.com/login"
              {...form.register("startUrl")}
            />
            {form.formState.errors.startUrl && (
              <p className="text-xs text-destructive">
                {form.formState.errors.startUrl.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Overrides the project base URL for this test
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="et-tags">
              Tags{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Input
              id="et-tags"
              placeholder="smoke, auth, critical"
              {...form.register("tags")}
            />
            <p className="text-xs text-muted-foreground">Comma-separated</p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
