import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, MessageCircle, User, Settings, BarChart3 } from "lucide-react";

const tabs = [
  { path: "/home", label: "Home", icon: Home },
  { path: "/chat", label: "Chat", icon: MessageCircle },
  { path: "/stats", label: "Stats", icon: BarChart3 },
  { path: "/profile", label: "Profile", icon: User },
  { path: "/settings", label: "Settings", icon: Settings },
];

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav className="shrink-0 flex items-center justify-around glass border-t border-border/30 px-2 py-1.5 safe-area-bottom">
      {tabs.map((tab) => {
        const active = pathname === tab.path;
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
              active
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className={`h-5 w-5 ${active ? "scale-110" : ""} transition-transform`} />
            <span className="text-[10px] font-semibold">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
