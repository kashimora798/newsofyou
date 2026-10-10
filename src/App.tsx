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
import ErrorBoundary from "@/components/layout/ErrorBoundary";
import { RemindersProvider } from "@/contexts/RemindersContext";

// Eagerly loaded (critical path)
// The decoy portal is the landing page — it stays eager so `/` paints in one
// round trip. Everything else waits until it is actually opened.
import DecoyLogin from "./pages/DecoyLogin";
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const HiddenLogin = lazy(() => import("./pages/HiddenLogin"));
const SecretLogin = lazy(() => import("./pages/SecretLogin"));
import OwnerRoute from "@/components/layout/OwnerRoute";

// Lazy loaded
const AdminTwin = lazy(() => import("./pages/AdminTwin"));
const StudyApp = lazy(() => import("./pages/StudyApp"));
const DevScene = lazy(() => import("./pages/DevScene"));
const Book = lazy(() => import("./pages/Book"));
const TwinChat = lazy(() => import("./pages/TwinChat"));
const FaceToFace = lazy(() => import("./pages/FaceToFace"));
const BookPrint = lazy(() => import("./pages/BookPrint"));
const BookPageView = lazy(() => import("./pages/BookPage"));
const DevBook = lazy(() => import("./pages/DevBook"));
const Chat = lazy(() => import("./pages/Chat"));
const Home = lazy(() => import("./pages/Home"));
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
const Wrapped = lazy(() => import("./pages/Wrapped"));
const SecretGarden = lazy(() => import("./pages/SecretGarden"));
const Forest = lazy(() => import("./pages/Forest"));
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
  <PartnerRoute>
    <ErrorBoundary>{children}</ErrorBoundary>
  </PartnerRoute>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <AuthProvider>
          <TooltipProvider>
            <RemindersProvider>
              <Toaster />
              <Sonner />
              <OfflineBanner />
              <BrowserRouter>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    {/* The public face of myanshika.xyz: the school portal sign-in. */}
                    <Route path="/" element={<DecoyLogin />} />
                    {/* Behind the decoy credential — a local, fake study portal. */}
                    <Route path="/study" element={<StudyApp />} />
                    {/* The real door. Reached from the front page's "Faculty & alumni" link. */}
                    <Route path="/real" element={<SecretLogin />} />
                    {/* Design preview of the Home scene — development builds only. */}
                    {import.meta.env.DEV && <Route path="/dev/scene" element={<DevScene />} />}
                    {import.meta.env.DEV && <Route path="/dev/book" element={<DevBook />} />}
                    <Route path="/login" element={<NotFound />} />
                    <Route path="/you" element={<Navigate to="/you/login" replace />} />
                    <Route path="/you/login" element={<HiddenLogin />} />
                    <Route path="/you/dashboard" element={<AdminRoute allowNonAdmin><AdminDashboard /></AdminRoute>} />
                    <Route path="/you/twin" element={<OwnerRoute><AdminTwin /></OwnerRoute>} />
                    <Route path="/you/control" element={<AdminRoute><Chat /></AdminRoute>} />
                    <Route path="/chat" element={<Chat />} />
                    <Route path="/home" element={<P><Home /></P>} />
                    <Route path="/profile" element={<Navigate to="/settings" replace />} />
                    <Route path="/settings" element={<P><SettingsPage /></P>} />
                    <Route path="/stats" element={<P><Stats /></P>} />
                    <Route path="/scheduled-messages" element={<P><ScheduledMessages /></P>} />
                    <Route path="/custom-stickers" element={<P><CustomStickers /></P>} />
                    <Route path="/custom-touch-reactions" element={<P><CustomTouchReactions /></P>} />
                    <Route path="/achievements" element={<P><Achievements /></P>} />
                    <Route path="/book" element={<P><Book /></P>} />
                    <Route path="/book/print" element={<P><BookPrint /></P>} />
                    <Route path="/book/:date" element={<P><BookPageView /></P>} />
                    <Route path="/twin" element={<P><TwinChat /></P>} />
                    <Route path="/face-to-face" element={<P><FaceToFace /></P>} />
                    <Route path="/letter-collection" element={<P><LetterCollection /></P>} />
                    <Route path="/bookmarks" element={<P><Bookmarks /></P>} />
                    <Route path="/reminders" element={<P><Reminders /></P>} />
                    <Route path="/calendar" element={<P><SharedCalendar /></P>} />
                    <Route path="/compliments" element={<P><ComplimentBox /></P>} />
                    <Route path="/daily-checklist" element={<P><DailyChecklist /></P>} />
                    <Route path="/games" element={<P><Games /></P>} />
                    <Route path="/wrapped" element={<P><Wrapped /></P>} />
                    <Route path="/garden" element={<P><SecretGarden /></P>} />
                    <Route path="/forest" element={<P><Forest /></P>} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </RemindersProvider>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
