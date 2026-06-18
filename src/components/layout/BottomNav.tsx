import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, MessageCircle, Settings, Gamepad2 } from "lucide-react";
import { motion } from "framer-motion";

const tabs = [
  { path: "/home", label: "Home", icon: Home },
  { path: "/chat", label: "Chat", icon: MessageCircle },
  { path: "/games", label: "Games", icon: Gamepad2 },
  { path: "/settings", label: "Profile", icon: Settings },
];

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav className="shrink-0 flex items-center justify-around glass border-t-[0.5px] border-border/60 px-2 py-1.5 safe-area-bottom">
      {tabs.map((tab) => {
        const active = pathname === tab.path;
        return (
          <motion.button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            whileTap={{ scale: 0.88 }}
            className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl transition-colors ${
              active
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <motion.div
              animate={active ? { scale: 1.12, y: -1 } : { scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
            >
              <tab.icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.2 : 1.8} />
            </motion.div>
            <span className="text-[10px] font-medium tracking-tight">{tab.label}</span>
          </motion.button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
