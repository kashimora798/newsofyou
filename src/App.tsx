import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "next-themes";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import SettingsPage from "./pages/Settings";
import Stats from "./pages/Stats";
import ScheduledMessages from "./pages/ScheduledMessages";
import CustomStickers from "./pages/CustomStickers";
import CustomTouchReactions from "./pages/CustomTouchReactions";
import Achievements from "./pages/Achievements";
import LetterCollection from "./pages/LetterCollection";
import TodoList from "./pages/TodoList";
import Bookmarks from "./pages/Bookmarks";
import Reminders from "./pages/Reminders";
import SharedCalendar from "./pages/SharedCalendar";
import ComplimentBox from "./pages/ComplimentBox";
import DailyChecklist from "./pages/DailyChecklist";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
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
              <Route path="/todos" element={<TodoList />} />
              <Route path="/bookmarks" element={<Bookmarks />} />
              <Route path="/reminders" element={<Reminders />} />
              <Route path="/calendar" element={<SharedCalendar />} />
              <Route path="/compliments" element={<ComplimentBox />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
