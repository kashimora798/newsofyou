import React from "react";
import { useReminders } from "@/hooks/useReminders";

const ReminderWatcher: React.FC = () => {
  // Mounts the due-time check & realtime incoming alerts globally
  useReminders();
  return null;
};

export default ReminderWatcher;
