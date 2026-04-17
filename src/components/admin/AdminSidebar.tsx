import { useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Lock, Home, LogOut, Users, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const menuGroups = [
  {
    label: "Dashboard",
    items: [{ title: "Overview", url: "/you/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Security",
    items: [
      { title: "Ban Queue", url: "/you/control", icon: ShieldAlert },
      { title: "Access Rules", url: "/you/login", icon: Lock },
    ],
  },
  {
    label: "People",
    items: [{ title: "Partners", url: "/chat", icon: Users }],
  },
];

const AdminSidebar = () => {
  const { signOut, user } = useAuth();
  const { state, setOpenMobile, isMobile } = useSidebar();
  const location = useLocation();
  const collapsed = state === "collapsed";

  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [location.pathname, isMobile, setOpenMobile]);

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b p-4">
        <div className={cn("flex items-center gap-2", collapsed && "justify-center")}>
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">N</span>
          </div>
          {!collapsed && <span className="font-semibold text-lg">NewsOfYou Admin</span>}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {menuGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = location.pathname === item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={active}>
                        <NavLink
                          to={item.url}
                          className={cn("flex items-center gap-2", active && "bg-primary/10 text-primary")}
                        >
                          <item.icon className="h-4 w-4" />
                          <span className="flex-1">{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <div className="space-y-2">
          <NavLink to="/" target="_blank">
            <Button variant="outline" size="sm" className="w-full justify-start">
              <Home className="h-4 w-4 mr-2" />
              {!collapsed && "View Website"}
            </Button>
          </NavLink>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={() => signOut()}
          >
            <LogOut className="h-4 w-4 mr-2" />
            {!collapsed && "Sign Out"}
          </Button>
          {!collapsed && user && <p className="text-xs text-muted-foreground truncate px-2">{user.email}</p>}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AdminSidebar;
