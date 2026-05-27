import { SidebarProvider, SidebarInset } from '@workspace/ui/components/sidebar';
import { TooltipProvider } from '@workspace/ui/components/tooltip';
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
