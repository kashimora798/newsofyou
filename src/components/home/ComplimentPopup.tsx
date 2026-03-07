import React from "react";
import { useCompliments } from "@/hooks/useCompliments";
import { Heart, X } from "lucide-react";

const ComplimentPopup: React.FC = () => {
  const { randomCompliment, dismissCompliment } = useCompliments();

  if (!randomCompliment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in fade-in" onClick={dismissCompliment}>
      <div className="bg-card rounded-2xl border border-border p-6 mx-6 max-w-sm shadow-xl animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end mb-2">
          <button onClick={dismissCompliment} className="p-1 rounded-full hover:bg-muted"><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="text-center">
          <Heart className="h-8 w-8 text-primary mx-auto mb-3 animate-pulse" />
          <p className="text-base text-foreground font-medium leading-relaxed">"{randomCompliment.content}"</p>
          <p className="text-xs text-muted-foreground mt-3">A secret compliment from your partner 💕</p>
        </div>
      </div>
    </div>
  );
};

export default ComplimentPopup;
