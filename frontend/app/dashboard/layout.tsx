
import { AppSidebar } from "@/components/custom/Sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="px-4 w-full">
        {/* <SidebarTrigger /> */}
        {children}
        </main>

    </SidebarProvider>
  );
} 