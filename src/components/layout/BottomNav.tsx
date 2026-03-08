import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, MessageCircle, User, Settings, Gamepad2 } from "lucide-react";
import { motion } from "framer-motion";

const tabs = [
  { path: "/home", label: "Home", icon: Home },
  { path: "/chat", label: "Chat", icon: MessageCircle },
  { path: "/games", label: "Games", icon: Gamepad2 },
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
          <motion.button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            whileTap={{ scale: 0.85 }}
            className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
              active
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {active && (
              <motion.div
                layoutId="nav-indicator"
                className="absolute -top-1 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full bg-primary"
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              />
            )}
            <motion.div
              animate={active ? { scale: 1.15, y: -1 } : { scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <tab.icon className="h-5 w-5" />
            </motion.div>
            <span className="text-[10px] font-semibold">{tab.label}</span>
          </motion.button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
