'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { useActiveProject } from '@/hooks/useActiveProject';
import { NewProjectSheet } from '@/components/projects/NewProjectSheet';
import { ROUTES } from '@/lib/routes';
import { Button } from '@workspace/ui/components/button';
import { Separator } from '@workspace/ui/components/separator';
import { SidebarTrigger } from '@workspace/ui/components/sidebar';

export default function DashboardPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const { activeProject, projects, setActiveProject } = useActiveProject();
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  useEffect(() => {
    if (!isPending && !session) router.push(ROUTES.login);
  }, [session, isPending, router]);

  useEffect(() => {
    if (activeProject) router.replace(ROUTES.projectTests(activeProject.id));
  }, [activeProject, router]);

  if (isPending || !session) return null;

  if (!activeProject && projects.length === 0) {
    return (
      <>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="text-sm font-medium text-foreground">Dashboard</span>
        </header>
        <div className="flex flex-col items-center justify-center flex-1 py-20 gap-4 text-center">
          <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center text-2xl">🔍</div>
          <h2 className="text-foreground font-medium">No projects yet</h2>
          <p className="text-muted-foreground text-xs">Create your first project to get started</p>
          <Button onClick={() => setNewProjectOpen(true)}>Create project</Button>
        </div>
        <NewProjectSheet
          open={newProjectOpen}
          onOpenChange={setNewProjectOpen}
          onCreated={(id) => { setActiveProject(id); router.push(ROUTES.projectTests(id)); }}
        />
      </>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
