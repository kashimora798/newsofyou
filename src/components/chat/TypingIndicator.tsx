import React from "react";

const TypingIndicator: React.FC = () => (
  <div className="flex justify-start animate-fade-in">
    <div className="bg-bubble-partner rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-muted-foreground/40"
            style={{ animation: `typing-dot 1.4s infinite ${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  </div>
);

export default TypingIndicator;
