import React from "react";

// Lightweight chat skeleton shown on first load instead of a bare spinner —
// makes the chat feel faster by hinting at the bubble layout immediately.
const widths = ["55%", "40%", "70%", "35%", "60%", "48%", "65%"];

const MessageListSkeleton: React.FC = () => (
  <div className="flex-1 overflow-hidden bg-chat-bg px-3 py-3" aria-hidden>
    <div className="space-y-3">
      {widths.map((w, i) => {
        const own = i % 3 === 0;
        return (
          <div key={i} className={`flex ${own ? "justify-end" : "justify-start"}`}>
            <div
              className="h-9 animate-pulse rounded-2xl bg-muted/50"
              style={{ width: w, maxWidth: "75%" }}
            />
          </div>
        );
      })}
    </div>
  </div>
);

export default MessageListSkeleton;
