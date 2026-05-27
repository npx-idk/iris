'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Logout01Icon, FirstBracketIcon, Activity01Icon, TestTube01Icon,
  ArrowDown01Icon, DashboardSquare01Icon, Add01Icon, FlowSquareIcon,
} from '@hugeicons/core-free-icons';
import { useSession, signOut } from '@/lib/auth-client';
import { useActiveProject } from '@/hooks/useActiveProject';
import { NewProjectSheet } from '@/components/projects/NewProjectSheet';
import { ROUTES } from '@/lib/routes';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupContent, SidebarHeader, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem,
} from '@iris/ui/components/sidebar';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from '@iris/ui/components/animate-ui/components/radix/dropdown-menu';

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { activeProject, projects, setActiveProject } = useActiveProject();
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  const initial = (session?.user.name ?? session?.user.email ?? '?').charAt(0).toUpperCase();

  const testsHref = activeProject ? ROUTES.projectTests(activeProject.id) : ROUTES.dashboard;
  const flowsHref = activeProject ? ROUTES.projectFlows(activeProject.id) : ROUTES.dashboard;
  const dashboardHref = activeProject ? ROUTES.project(activeProject.id) : ROUTES.dashboard;

  const isTestsActive = !!activeProject && pathname.startsWith(ROUTES.projectTests(activeProject.id));
  const isFlowsActive = !!activeProject && pathname.startsWith(ROUTES.projectFlows(activeProject.id));
  const isDashboardActive = !!activeProject && pathname === ROUTES.project(activeProject.id);

  function handleProjectCreated(projectId: string) {
    setNewProjectOpen(false);
    setActiveProject(projectId);
    router.push(ROUTES.projectTests(projectId));
  }

  return (
    <>
      <Sidebar collapsible="icon">
        {/* Project switcher */}
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                    tooltip={activeProject?.name ?? 'Select project'}
                  >
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm shrink-0">
                      {activeProject?.name.charAt(0).toUpperCase() ?? 'I'}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1 text-left">
                      <span className="font-semibold text-foreground truncate text-sm">
                        {activeProject?.name ?? 'Select project'}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">Switch project</span>
                    </div>
                    <HugeiconsIcon icon={ArrowDown01Icon} size={14} color="currentColor" strokeWidth={1.5} className="ml-auto shrink-0 text-muted-foreground" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>

                <DropdownMenuContent side="bottom" align="start" className="w-56">
                  <DropdownMenuLabel>Projects</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {projects.map((project) => (
                    <DropdownMenuItem
                      key={project.id}
                      onSelect={() => {
                        setActiveProject(project.id);
                        router.push(ROUTES.projectTests(project.id));
                      }}
                    >
                      <div className="size-5 rounded bg-muted flex items-center justify-center text-xs font-semibold shrink-0">
                        {project.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="flex-1 truncate">{project.name}</span>
                      {project.id === activeProject?.id && (
                        <span className="text-primary text-xs">✓</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setNewProjectOpen(true)}>
                    <HugeiconsIcon icon={Add01Icon} size={14} color="currentColor" strokeWidth={1.5} />
                    New project
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isDashboardActive} tooltip="Dashboard">
                    <Link href={dashboardHref}>
                      <HugeiconsIcon icon={DashboardSquare01Icon} size={16} color="currentColor" strokeWidth={1.5} />
                      <span>Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isTestsActive} tooltip="Tests">
                    <Link href={testsHref}>
                      <HugeiconsIcon icon={TestTube01Icon} size={16} color="currentColor" strokeWidth={1.5} />
                      <span>Tests</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isFlowsActive} tooltip="Flows">
                    <Link href={flowsHref}>
                      <HugeiconsIcon icon={FlowSquareIcon} size={16} color="currentColor" strokeWidth={1.5} />
                      <span>Flows</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === ROUTES.variables} tooltip="Variables">
                    <Link href={ROUTES.variables}>
                      <HugeiconsIcon icon={FirstBracketIcon} size={16} color="currentColor" strokeWidth={1.5} />
                      <span>Variables</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === ROUTES.runs} tooltip="Runs">
                    <Link href={ROUTES.runs}>
                      <HugeiconsIcon icon={Activity01Icon} size={16} color="currentColor" strokeWidth={1.5} />
                      <span>Runs</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" tooltip={session?.user.email ?? 'Account'}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-semibold shrink-0">
                  {initial}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs font-medium text-foreground truncate">
                    {session?.user.name ?? 'User'}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {session?.user.email}
                  </span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Sign out"
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => signOut().then(() => router.push(ROUTES.login))}
              >
                <HugeiconsIcon icon={Logout01Icon} size={16} color="currentColor" strokeWidth={1.5} />
                <span>Sign out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <NewProjectSheet
        open={newProjectOpen}
        onOpenChange={setNewProjectOpen}
        onCreated={handleProjectCreated}
      />
    </>
  );
}
