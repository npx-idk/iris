'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { Folder01Icon, Logout01Icon, FirstBracketIcon } from '@hugeicons/core-free-icons';
import { useSession, signOut } from '@/lib/auth-client';
import { ROUTES } from '@/lib/routes';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@workspace/ui/components/sidebar';

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  const initial = (session?.user.name ?? session?.user.email ?? '?').charAt(0).toUpperCase();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href={ROUTES.dashboard}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm shrink-0">
                  I
                </div>
                <span className="font-semibold text-foreground">Iris</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === ROUTES.dashboard || pathname.startsWith('/projects')}
                  tooltip="Projects"
                >
                  <Link href={ROUTES.dashboard}>
                    <HugeiconsIcon icon={Folder01Icon} size={16} color="currentColor" strokeWidth={1.5} />
                    <span>Projects</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === ROUTES.variables}
                  tooltip="Variables"
                >
                  <Link href={ROUTES.variables}>
                    <HugeiconsIcon icon={FirstBracketIcon} size={16} color="currentColor" strokeWidth={1.5} />
                    <span>Variables</span>
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
            <SidebarMenuButton
              size="lg"
              tooltip="Sign out"
              onClick={() => signOut().then(() => router.push(ROUTES.login))}
            >
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
              <HugeiconsIcon icon={Logout01Icon} size={16} color="currentColor" strokeWidth={1.5} className="shrink-0 text-muted-foreground" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
