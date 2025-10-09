"use client";

import {
  BarChart3,
  Settings,
  LogOut,
  Search,
  ChevronLeft,
  ChevronRight,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { usePathname, useRouter } from "next/navigation";
import { sidebarStore } from "@/stores/sidebar";
import { useTransition } from "react";
import { logoutAction } from "@/lib/auth";

// Import shadcn Sidebar components
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import Link from "next/link";

export function AppSidebar() {
  const { isOpen, toggle } = sidebarStore();
  const { theme } = useTheme();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  const navigationItems = [
    {
      id: "analytics",
      label: "Duplication Analytics",
      icon: BarChart3,
      badge: null,
      description: "Visualize insights with AI",
      pathname: "/dashboard",
    },
    {
      id: "natural-query",
      label: "Natural Query",
      icon: Search,
      badge: null,
      description: "Ask questions in plain English",
      pathname: "/dashboard/natural-query",
    },
    {
      id: "dup-rules",
      label: "Duplicate Rules",
      icon: Settings,
      badge: null,
      description: "Tune dedupe thresholds",
      pathname: "/dashboard/duplicates/settings",
    },
  ];

  const handleLogout = () => {
    startTransition(async () => {
      await logoutAction();
      router.push("/auth/login")
    });
  };

  return (
    <Sidebar >
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary text-primary-foreground font-bold">
            DA
          </div>

          <div>
            <h1 className="font-semibold">Data Analyzer</h1>
            <p className="text-xs text-muted-foreground">AI-Powered</p>
          </div>

        </div>
      </SidebarHeader>

      <SidebarContent >
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.label} >
                  <SidebarMenuButton asChild className={cn("rounded-sm h-10", { "bg-primary text-white  hover:bg-primary/90 hover:text-white": pathname === item.pathname })}>
                    <Link href={item.pathname}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2 p-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src="/placeholder-user.jpg" alt="User" />
            <AvatarFallback>NG</AvatarFallback>
          </Avatar>
     
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Admin</p>
              <p className="text-xs text-muted-foreground">admin@gmail.com</p>
            </div>
        </div>

        <Button
          variant="ghost"
          className="w-full justify-start gap-2"
          onClick={handleLogout}
          disabled={isPending}
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}