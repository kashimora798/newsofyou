import React from "react";

interface PulsePointProps {
  onClick: () => void;
  visible: boolean;
}

const PulsePoint: React.FC<PulsePointProps> = ({ onClick, visible }) => {
  if (!visible) return null;

  return (
    <button
      onClick={onClick}
      className="absolute bottom-[15%] left-1/2 -translate-x-1/2 z-20 group cursor-pointer focus:outline-none"
      aria-label="Enter"
    >
      {/* Outer pulse rings */}
      <div className="absolute inset-0 -m-6 rounded-full animate-[pulse-ring_2s_ease-out_infinite] opacity-30"
        style={{ background: "radial-gradient(circle, rgba(200,20,40,0.4) 0%, transparent 70%)" }}
      />
      <div className="absolute inset-0 -m-10 rounded-full animate-[pulse-ring_2s_ease-out_0.5s_infinite] opacity-20"
        style={{ background: "radial-gradient(circle, rgba(200,20,40,0.3) 0%, transparent 70%)" }}
      />
      {/* Core dot */}
      <div className="relative w-5 h-5 rounded-full animate-[pulse-core_2s_ease-in-out_infinite]"
        style={{
          background: "radial-gradient(circle at 40% 40%, #ff3344, #991122)",
          boxShadow: "0 0 20px rgba(200,20,40,0.6), 0 0 60px rgba(200,20,40,0.3)",
        }}
      />
      {/* Touch hint text */}
      <span className="absolute top-8 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.3em] uppercase whitespace-nowrap opacity-40 group-hover:opacity-70 transition-opacity duration-700"
        style={{ color: "#cc3344", fontFamily: "'Quicksand', sans-serif" }}
      >
        touch
      </span>
    </button>
  );
};

export default PulsePoint;
