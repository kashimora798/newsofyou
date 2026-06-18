// Visual skins for the decoy / panic mode. Each imitates a famous AI app
// closely enough to pass a glance, using its colors and layout.

export type DecoySkin = "chatgpt" | "gemini" | "claude";

export interface DecoySkinConfig {
  id: DecoySkin;
  name: string;
  // Header
  headerBg: string;
  headerText: string;
  accent: string;          // send button / user bubble
  pageBg: string;
  botBubbleBg: string;
  botBubbleText: string;
  userBubbleText: string;
  inputBg: string;
  placeholder: string;
  greeting: string;
  // Seed conversation shown so the app looks "used".
  seed: { role: "user" | "assistant"; content: string }[];
}

export const DECOY_SKINS: Record<DecoySkin, DecoySkinConfig> = {
  chatgpt: {
    id: "chatgpt",
    name: "ChatGPT",
    headerBg: "#ffffff",
    headerText: "#0d0d0d",
    accent: "#10a37f",
    pageBg: "#ffffff",
    botBubbleBg: "#f7f7f8",
    botBubbleText: "#0d0d0d",
    userBubbleText: "#ffffff",
    inputBg: "#f4f4f4",
    placeholder: "Message ChatGPT…",
    greeting: "How can I help you today?",
    seed: [
      { role: "user", content: "give me a quick pasta recipe" },
      { role: "assistant", content: "Sure! Boil 200g spaghetti. Meanwhile sauté garlic in olive oil, add chili flakes, toss the drained pasta with a splash of pasta water, parmesan, and black pepper. Done in 12 minutes 🍝" },
      { role: "user", content: "thanks!" },
      { role: "assistant", content: "You're welcome! Enjoy your meal. Let me know if you'd like a vegetarian variation." },
    ],
  },
  gemini: {
    id: "gemini",
    name: "Gemini",
    headerBg: "#ffffff",
    headerText: "#1f1f1f",
    accent: "#1a73e8",
    pageBg: "#ffffff",
    botBubbleBg: "#f0f4f9",
    botBubbleText: "#1f1f1f",
    userBubbleText: "#ffffff",
    inputBg: "#f0f4f9",
    placeholder: "Enter a prompt here",
    greeting: "Hello, how can I help you today?",
    seed: [
      { role: "user", content: "summarize photosynthesis in one line" },
      { role: "assistant", content: "Plants convert sunlight, water, and CO₂ into glucose and oxygen using chlorophyll. 🌱" },
      { role: "user", content: "nice" },
      { role: "assistant", content: "Glad that helped! Want a diagram or a deeper explanation of the light-dependent reactions?" },
    ],
  },
  claude: {
    id: "claude",
    name: "Claude",
    headerBg: "#f5f4ef",
    headerText: "#1f1e1c",
    accent: "#d97757",
    pageBg: "#f5f4ef",
    botBubbleBg: "#ffffff",
    botBubbleText: "#1f1e1c",
    userBubbleText: "#ffffff",
    inputBg: "#ffffff",
    placeholder: "Reply to Claude…",
    greeting: "How can I help you today?",
    seed: [
      { role: "user", content: "what's a good book on habits?" },
      { role: "assistant", content: "Atomic Habits by James Clear is a popular, practical choice — it focuses on tiny, consistent improvements and how systems beat goals. Want a few alternatives?" },
      { role: "user", content: "yes" },
      { role: "assistant", content: "Try 'The Power of Habit' by Charles Duhigg and 'Tiny Habits' by BJ Fogg. Both pair well with Atomic Habits." },
    ],
  },
};
