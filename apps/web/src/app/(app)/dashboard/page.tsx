'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import type { Project } from '@/lib/types';
import { useQuery } from '@tanstack/react-query';
import { ROUTES } from '@/lib/routes';
import { PROJECT_ROLE_BADGE_VARIANT } from '@/lib/roles';
import { Button } from '@workspace/ui/components/button';
import { Badge } from '@workspace/ui/components/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { Separator } from '@workspace/ui/components/separator';
import { SidebarTrigger } from '@workspace/ui/components/sidebar';

export default function DashboardPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<Project[]>('/projects'),
    enabled: !!session,
  });

  useEffect(() => {
    if (!isPending && !session) router.push(ROUTES.login);
  }, [session, isPending, router]);

  if (isPending || !session) return null;

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <span className="text-sm font-medium text-foreground">Projects</span>
        <div className="ml-auto">
          <Button asChild size="sm">
            <Link href={ROUTES.projectNew}>+ New project</Link>
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-4 p-6">
        <div>
          <p className="text-xs text-muted-foreground">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-36 bg-card rounded-lg ring-1 ring-foreground/10 animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🔍</span>
            </div>
            <h2 className="text-foreground font-medium mb-1">No projects yet</h2>
            <p className="text-muted-foreground text-xs mb-6">
              Create your first project to start running AI tests
            </p>
            <Button asChild>
              <Link href={ROUTES.projectNew}>Create project</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Link key={project.id} href={ROUTES.project(project.id)}>
                <Card className="hover:ring-2 hover:ring-ring/50 transition-all cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-1">
                      <div className="w-9 h-9 bg-muted rounded-md flex items-center justify-center text-foreground font-semibold text-sm">
                        {project.name.charAt(0).toUpperCase()}
                      </div>
                      <RoleBadge role={project.role} />
                    </div>
                    <CardTitle>{project.name}</CardTitle>
                    {project.description && (
                      <CardDescription className="line-clamp-1">
                        {project.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground truncate">{project.baseUrl}</p>
                  </CardContent>
                  <CardFooter className="border-t border-border pt-3 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {project.memberCount} member{project.memberCount !== 1 ? 's' : ''}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(project.createdAt).toLocaleDateString()}
                    </span>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function RoleBadge({ role }: { role: string }) {
  const variant = PROJECT_ROLE_BADGE_VARIANT[role as keyof typeof PROJECT_ROLE_BADGE_VARIANT] ?? 'outline';
  return <Badge variant={variant}>{role.toLowerCase()}</Badge>;
}
