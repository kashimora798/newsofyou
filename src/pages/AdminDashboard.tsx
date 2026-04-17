import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AdminLayout from "@/components/admin/AdminLayout";
import { LayoutDashboard, Users, Calendar, Newspaper, Image, Megaphone, ClipboardList, FileText, TrendingUp, ArrowRight, Clock } from "lucide-react";

const AdminDashboard: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const invalidUser = new URLSearchParams(location.search).get("invalid") === "1";

  const quickActions = [
    { label: "Open Dashboard", icon: LayoutDashboard, path: "/you/dashboard" },
    { label: "Open Login", icon: FileText, path: "/you/login" },
    { label: "Public Website", icon: Newspaper, path: "/" },
    { label: "School Calendar", icon: Calendar, path: "/you/dashboard" },
  ];

  const stats = [
    { label: "Students", value: "248", icon: Users, color: "text-primary" },
    { label: "Messages", value: "1.2k", icon: ClipboardList, color: "text-secondary" },
    { label: "Announcements", value: "18", icon: Megaphone, color: "text-accent" },
    { label: "Events", value: "9", icon: Calendar, color: "text-emerald-500" },
  ];

  const contentCards = [
    { label: "News", count: 12, icon: Newspaper, path: "/you/dashboard" },
    { label: "Gallery", count: 84, icon: Image, path: "/you/dashboard" },
    { label: "Announcements", count: 18, icon: Megaphone, path: "/you/dashboard" },
    { label: "Reports", count: 6, icon: FileText, path: "/you/dashboard" },
  ];

  const recentActivity = [
    { text: "Principal circular drafted", time: "2 min ago" },
    { text: "Class schedule update published", time: "18 min ago" },
    { text: "Attendance alert acknowledged", time: "1 hour ago" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground uppercase tracking-[0.2em]">School Management</p>
            <h2 className="text-3xl font-bold">Admin Dashboard</h2>
            <p className="text-muted-foreground mt-1">Overview of the school control panel.</p>
            {invalidUser && <p className="text-sm font-medium text-destructive mt-1">Invalid user</p>}
          </div>
          <Badge variant="secondary" className="w-fit">System online</Badge>
        </div>

        <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">Updated just now</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5 text-primary" /> Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {quickActions.map((action) => (
                  <Button
                    key={action.label}
                    variant="outline"
                    className="h-auto justify-between px-4 py-4"
                    onClick={() => navigate(action.path)}
                  >
                    <span className="flex items-center gap-3">
                      <action.icon className="h-5 w-5 text-primary" />
                      <span className="font-medium">{action.label}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-5 w-5 text-primary" /> Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentActivity.map((activity) => (
                <div key={activity.text} className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-sm font-medium">{activity.text}</p>
                  <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Content Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {contentCards.map((item) => (
                <button
                  key={item.label}
                  onClick={() => navigate(item.path)}
                  className="rounded-xl border bg-card p-4 text-left transition-transform hover:-translate-y-0.5 hover:shadow-sm"
                >
                  <item.icon className="mb-3 h-5 w-5 text-muted-foreground" />
                  <p className="text-2xl font-bold">{item.count}</p>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
