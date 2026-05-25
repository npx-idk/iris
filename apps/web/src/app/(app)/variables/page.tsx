'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { WorkspaceVariable } from '@/lib/types';
import { VariableList } from '@/components/projects/VariableList';
import { Separator } from '@workspace/ui/components/separator';
import { SidebarTrigger } from '@workspace/ui/components/sidebar';

export default function VariablesPage() {
  const { data: variables = [], refetch } = useQuery({
    queryKey: ['workspace-variables'],
    queryFn: () => api.get<WorkspaceVariable[]>('/workspace/variables'),
  });

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <span className="text-sm font-medium text-foreground">Variables</span>
      </header>

      <div className="p-6 max-w-2xl">
        <VariableList
          variables={variables}
          onUpdate={() => refetch()}
        />
      </div>
    </>
  );
}
