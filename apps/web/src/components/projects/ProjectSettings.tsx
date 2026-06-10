"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { api } from "@/lib/api"
import type { ProjectDetail } from "@/lib/types"
import { Button } from "@iris/ui/components/button"
import { Input } from "@iris/ui/components/input"
import { Textarea } from "@iris/ui/components/textarea"
import { Label } from "@iris/ui/components/label"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@iris/ui/components/card"

const settingsSchema = z.object({
  name: z.string().min(1, "Name is required"),
  baseUrl: z.string().min(1, "Base URL is required").url("Enter a valid URL"),
  description: z.string().optional(),
})
type SettingsValues = z.infer<typeof settingsSchema>

/** General settings form + owner-only danger zone for a project. */
export function ProjectSettings({
  project,
  isOwner,
  onUpdate,
  onDelete,
}: {
  project: ProjectDetail
  isOwner: boolean
  onUpdate: () => void
  onDelete: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema as never),
    mode: "onBlur",
    defaultValues: {
      name: project.name,
      baseUrl: project.baseUrl,
      description: project.description ?? "",
    },
  })

  useEffect(() => {
    reset({
      name: project.name,
      baseUrl: project.baseUrl,
      description: project.description ?? "",
    })
  }, [project, reset])

  async function onSubmit(values: SettingsValues) {
    try {
      await api.patch(`/projects/${project.id}`, values)
      onUpdate()
    } catch (err) {
      setError("root", {
        message: err instanceof Error ? err.message : "Failed to save",
      })
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await api.delete(`/projects/${project.id}`)
      onDelete()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>General settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="settings-name">Name</Label>
              <Input id="settings-name" {...register("name")} />
              {errors.name && (
                <p className="text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="settings-url">Base URL</Label>
              <Input id="settings-url" {...register("baseUrl")} />
              {errors.baseUrl && (
                <p className="text-xs text-destructive">
                  {errors.baseUrl.message}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="settings-desc">Description</Label>
              <Textarea id="settings-desc" {...register("description")} />
            </div>
            {errors.root && (
              <p className="text-xs text-destructive">{errors.root.message}</p>
            )}
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {isOwner && (
        <Card className="ring-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive">Danger zone</CardTitle>
            <CardDescription>
              Deleting a project permanently removes all tests, runs, and API
              keys.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!confirmDelete ? (
              <Button
                variant="destructive"
                onClick={() => setConfirmDelete(true)}
              >
                Delete project
              </Button>
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-xs font-medium text-destructive">
                  Are you sure?
                </p>
                <Button
                  variant="destructive"
                  disabled={deleting}
                  onClick={handleDelete}
                >
                  {deleting ? "Deleting..." : "Yes, delete"}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
