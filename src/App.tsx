import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "next-themes";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import OfflineBanner from "@/components/layout/OfflineBanner";
import PartnerRoute from "@/components/layout/PartnerRoute";
import AdminRoute from "@/components/layout/AdminRoute";

// Eagerly loaded (critical path)
import Index from "./pages/Index";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";

// Lazy loaded
const Chat = lazy(() => import("./pages/Chat"));
const Home = lazy(() => import("./pages/Home"));
const Profile = lazy(() => import("./pages/Profile"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const Stats = lazy(() => import("./pages/Stats"));
const ScheduledMessages = lazy(() => import("./pages/ScheduledMessages"));
const CustomStickers = lazy(() => import("./pages/CustomStickers"));
const CustomTouchReactions = lazy(() => import("./pages/CustomTouchReactions"));
const Achievements = lazy(() => import("./pages/Achievements"));
const LetterCollection = lazy(() => import("./pages/LetterCollection"));
const Bookmarks = lazy(() => import("./pages/Bookmarks"));
const Reminders = lazy(() => import("./pages/Reminders"));
const SharedCalendar = lazy(() => import("./pages/SharedCalendar"));
const ComplimentBox = lazy(() => import("./pages/ComplimentBox"));
const DailyChecklist = lazy(() => import("./pages/DailyChecklist"));
const Games = lazy(() => import("./pages/Games"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 10,
      retry: 1,
      refetchOnWindowFocus: false,
      networkMode: "offlineFirst",
    },
    mutations: {
      networkMode: "offlineFirst",
    },
  },
});

const PageLoader = () => (
  <div className="flex h-dvh items-center justify-center bg-background">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

const P = ({ children }: { children: React.ReactNode }) => (
  <PartnerRoute>{children}</PartnerRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <OfflineBanner />
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<NotFound />} />
                <Route path="/you" element={<Navigate to="/you/login" replace />} />
                <Route path="/you/login" element={<AdminLogin />} />
                <Route path="/you/dashboard" element={<AdminRoute allowNonAdmin><AdminDashboard /></AdminRoute>} />
                <Route path="/you/control" element={<AdminRoute><Chat /></AdminRoute>} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/home" element={<P><Home /></P>} />
                <Route path="/profile" element={<P><Profile /></P>} />
                <Route path="/settings" element={<P><SettingsPage /></P>} />
                <Route path="/stats" element={<P><Stats /></P>} />
                <Route path="/scheduled-messages" element={<P><ScheduledMessages /></P>} />
                <Route path="/custom-stickers" element={<P><CustomStickers /></P>} />
                <Route path="/custom-touch-reactions" element={<P><CustomTouchReactions /></P>} />
                <Route path="/achievements" element={<P><Achievements /></P>} />
                <Route path="/letter-collection" element={<P><LetterCollection /></P>} />
                <Route path="/bookmarks" element={<P><Bookmarks /></P>} />
                <Route path="/reminders" element={<P><Reminders /></P>} />
                <Route path="/calendar" element={<P><SharedCalendar /></P>} />
                <Route path="/compliments" element={<P><ComplimentBox /></P>} />
                <Route path="/daily-checklist" element={<P><DailyChecklist /></P>} />
                <Route path="/games" element={<P><Games /></P>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
