"use client"

import { useWorkspaceVariables } from "@/hooks/queries"
import { VariableList } from "@/components/projects/VariableList"
import { Separator } from "@iris/ui/components/separator"
import { SidebarTrigger } from "@iris/ui/components/sidebar"

export default function VariablesPage() {
  const { data: variables = [], refetch } = useWorkspaceVariables()

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <span className="text-sm font-medium text-foreground">Variables</span>
      </header>

      <div className="max-w-2xl p-6">
        <VariableList variables={variables} onUpdate={() => refetch()} />
      </div>
    </>
  )
}
