import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";

/** Dashboard entry for the auto-generated chat journal (e-book). */
const JournalCard: React.FC = () => {
  const navigate = useNavigate();
  return (
    <motion.button
      type="button"
      onClick={() => navigate("/journal")}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="group relative w-full overflow-hidden rounded-3xl p-4 text-left"
      style={{
        background: "linear-gradient(135deg, hsl(350 70% 60% / 0.14) 0%, hsl(35 90% 60% / 0.16) 100%)",
        border: "1px solid hsl(350 60% 55% / 0.2)",
        boxShadow: "0 8px 28px -14px hsl(350 60% 40% / 0.4)",
      }}
    >
      <div className="flex items-center gap-4">
        {/* mini book that opens a crack on hover */}
        <div className="relative h-[68px] w-[54px] shrink-0" style={{ perspective: 300 }}>
          <div className="absolute inset-0 rounded-sm bg-[#fffdf8] shadow" style={{ transform: "translateX(3px)" }}>
            <div className="mx-1.5 mt-2 space-y-1">
              {[0, 1, 2, 3, 4].map((i) => (<div key={i} className="h-px bg-rose-300/70" style={{ width: `${70 - i * 8}%` }} />))}
            </div>
          </div>
          <div
            className="absolute inset-0 origin-left rounded-r-md rounded-l-[2px] transition-transform duration-500 group-hover:[transform:rotateY(-28deg)]"
            style={{ background: "linear-gradient(135deg, #8d3d52, #561f33)", boxShadow: "3px 4px 10px rgba(60,20,30,.4)" }}
          >
            <div className="absolute inset-1 left-2 rounded border border-dashed border-amber-200/40" />
            <span className="absolute inset-0 flex items-center justify-center text-lg">💌</span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-[15px] font-bold text-foreground">Our Journal</p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            Your chats, written as a scrapbook — photos, voice notes &amp; all. Browse by month.
          </p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-rose-500/60 transition-all group-hover:translate-x-0.5 group-hover:text-rose-500" />
      </div>
    </motion.button>
  );
};

export default JournalCard;
