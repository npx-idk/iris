"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { api } from "@/lib/api"
import { useProject } from "@/hooks/queries"
import { MemberList } from "@/components/projects/MemberList"
import { ProjectSettings } from "@/components/projects/ProjectSettings"
import { ApiKeyList } from "@/components/projects/ApiKeyList"
import type { ApiKey } from "@/lib/types"
import { ROUTES } from "@/lib/routes"
import { can } from "@iris/common"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@iris/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@iris/ui/components/card"
import { Separator } from "@iris/ui/components/separator"
import { SidebarTrigger } from "@iris/ui/components/sidebar"

type Tab = "dashboard" | "members" | "api-keys" | "settings"

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("dashboard")

  const {
    data: project,
    isLoading,
    isError,
    refetch: refetchProject,
  } = useProject(id)

  const canManage = project && can(project.role, "manage")
  const isOwner = project && can(project.role, "delete-project")

  const { data: apiKeys = [], refetch: refetchApiKeys } = useQuery({
    queryKey: ["api-keys", id],
    queryFn: () => api.get<ApiKey[]>(`/projects/${id}/api-keys`),
    enabled: tab === "api-keys" && !!canManage,
  })

  const redirected = useRef(false)
  useEffect(() => {
    if (isError && !redirected.current) {
      redirected.current = true
      router.push(ROUTES.dashboard)
    }
  }, [isError, router])

  if (isLoading || !project) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: "dashboard", label: "Dashboard", show: true },
    {
      key: "members",
      label: `Members (${project.members.length})`,
      show: true,
    },
    { key: "api-keys", label: "API Keys", show: !!canManage },
    { key: "settings", label: "Settings", show: !!canManage },
  ]

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <span className="text-sm font-medium text-foreground">
          {project.name} — Settings
        </span>
      </header>

      <div className="flex gap-0 border-b border-border px-4">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`mr-4 border-b-2 px-1 py-3 text-xs font-medium transition-colors ${
                tab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
      </div>

      <div className="p-6">
        {tab === "dashboard" && (
          <Card>
            <CardHeader>
              <CardTitle>Project details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <div className="flex gap-4">
                  <dt className="w-28 shrink-0 text-xs text-muted-foreground">
                    Base URL
                  </dt>
                  <dd className="text-xs text-foreground">{project.baseUrl}</dd>
                </div>
                {project.description && (
                  <div className="flex gap-4">
                    <dt className="w-28 shrink-0 text-xs text-muted-foreground">
                      Description
                    </dt>
                    <dd className="text-xs text-foreground">
                      {project.description}
                    </dd>
                  </div>
                )}
                <div className="flex gap-4">
                  <dt className="w-28 shrink-0 text-xs text-muted-foreground">
                    Your role
                  </dt>
                  <dd className="text-xs text-foreground capitalize">
                    {project.role.toLowerCase()}
                  </dd>
                </div>
                <div className="flex gap-4">
                  <dt className="w-28 shrink-0 text-xs text-muted-foreground">
                    Created
                  </dt>
                  <dd className="text-xs text-foreground">
                    {new Date(project.createdAt).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
              <div className="mt-6 border-t border-border pt-6">
                <Button asChild variant="outline" size="sm">
                  <Link href={ROUTES.projectTests(id)}>View tests →</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {tab === "members" && (
          <MemberList
            members={project.members}
            projectId={id}
            canManage={!!canManage}
            isOwner={!!isOwner}
            onUpdate={() => refetchProject()}
          />
        )}

        {tab === "api-keys" && canManage && (
          <ApiKeyList
            apiKeys={apiKeys}
            projectId={id}
            onUpdate={() => refetchApiKeys()}
          />
        )}

        {tab === "settings" && canManage && (
          <ProjectSettings
            project={project}
            isOwner={!!isOwner}
            onUpdate={() => refetchProject()}
            onDelete={() => router.push(ROUTES.dashboard)}
          />
        )}
      </div>
    </>
  )
}
