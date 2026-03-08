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

// Eagerly loaded (critical path)
import Login from "./pages/Login";
import Home from "./pages/Home";

// Lazy loaded (secondary pages)
const Chat = lazy(() => import("./pages/Chat"));
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
      staleTime: 1000 * 60 * 2, // 2 min — avoid refetching on every mount
      gcTime: 1000 * 60 * 10, // 10 min cache
      retry: 1,
      refetchOnWindowFocus: false,
      networkMode: "offlineFirst", // serve cache when offline
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
                <Route path="/" element={<Navigate to="/home" replace />} />
                <Route path="/login" element={<Login />} />
                <Route path="/home" element={<Home />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/stats" element={<Stats />} />
                <Route path="/scheduled-messages" element={<ScheduledMessages />} />
                <Route path="/custom-stickers" element={<CustomStickers />} />
                <Route path="/custom-touch-reactions" element={<CustomTouchReactions />} />
                <Route path="/achievements" element={<Achievements />} />
                <Route path="/letter-collection" element={<LetterCollection />} />
                <Route path="/bookmarks" element={<Bookmarks />} />
                <Route path="/reminders" element={<Reminders />} />
                <Route path="/calendar" element={<SharedCalendar />} />
                <Route path="/compliments" element={<ComplimentBox />} />
                <Route path="/daily-checklist" element={<DailyChecklist />} />
                <Route path="/games" element={<Games />} />
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
