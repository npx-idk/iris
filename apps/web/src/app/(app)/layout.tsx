import { SidebarProvider, SidebarInset } from '@iris/ui/components/sidebar';
import { TooltipProvider } from '@iris/ui/components/tooltip';
import { AppSidebar } from '@/components/app-sidebar';
import { ActiveRunsNotification } from '@/components/ActiveRunsNotification';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
        <SidebarInset>{children}</SidebarInset>
      </SidebarProvider>
      <ActiveRunsNotification />
    </TooltipProvider>
  );
}
