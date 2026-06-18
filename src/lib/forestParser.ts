/**
 * forestParser.ts
 * Converts raw chat messages into deterministic ForestNode objects.
 * Pure client-side — no AI calls, no network. 100% reproducible from message data.
 */

export type ForestElementType =
  | "oak"
  | "cherry"
  | "willow"
  | "pine"
  | "redwood"
  | "sunflower"
  | "wildflower"
  | "mushroom"
  | "fern"
  | "crystal"
  | "bush"
  | "bamboo";

export interface ForestNode {
  id: string;
  messageId: string;
  type: ForestElementType;
  position: [number, number, number]; // [x, 0, z]
  scale: number;                       // 0.5 – 3.0
  colorVariant: number;                // 0–1 seed for color tinting
  rotation: number;                    // y-axis rotation radians
  hasFireflies: boolean;
  hasPetals: boolean;
  senderId: string;
  content: string;
  preview: string;                     // truncated display text
  createdAt: string;
  senderName: string;
}

// ─── Deterministic hash from a string → [0, 1) ──────────────────────────────
function hashStr(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

// ─── Multi-seed position spread — Halton sequence style ──────────────────────
function idToPosition(id: string, index: number): [number, number, number] {
  const h1 = hashStr(id + "x");
  const h2 = hashStr(id + "z");
  // Spiral outward as message count grows, spread in 2D plane
  const chunkX = Math.floor(index / 12);
  const chunkZ = Math.floor((index % 12) / 1);
  const cellX = chunkX * 20 + (h1 * 16 - 8);
  const cellZ = chunkZ * 20 + (h2 * 16 - 8);
  return [cellX, 0, cellZ];
}

// ─── Element type detection ───────────────────────────────────────────────────
function detectType(
  content: string,
  createdAt: string,
  messageType: string
): ForestElementType | "ignore" {
  const lower = (content || "").toLowerCase();

  // Image/media → Crystal
  if (
    messageType === "image" ||
    messageType === "gif" ||
    messageType === "sticker" ||
    messageType === "video"
  )
    return "crystal";

  // Emoji-only → Bush
  const emojiOnly = /^[\p{Emoji}\s]+$/u.test(content || "");
  if (emojiOnly && content.length > 0 && content.length < 20) return "bush";

  // Keyword detection
  if (/love|❤|🥰|😍|💕|💗/.test(lower)) return "cherry";
  if (/happy|😊|😄|🥳|yay|excited/.test(lower)) return "sunflower";
  if (/sorry|😢|😔|forgive|apologize/.test(lower)) return "mushroom";

  // Short messages
  if (content.length > 0 && content.length < 15) return "wildflower";

  // Ignore all other messages to improve load time and realistic look
  return "ignore";
}

// ─── Scale calculation ────────────────────────────────────────────────────────
function detectScale(content: string, type: ForestElementType): number {
  const len = (content || "").length;
  const base = Math.min(1 + len / 200, 2.8);
  // Special elements always mid-size
  if (type === "wildflower" || type === "mushroom" || type === "fern") {
    return 0.5 + hashStr(content.slice(0, 5)) * 0.4;
  }
  return Math.max(0.5, Math.min(base, 3.0));
}

// ─── Main parser ──────────────────────────────────────────────────────────────
export function parseMessageToForestNode(
  message: {
    id: string;
    user_id: string;
    username: string;
    content: string | null;
    message_type: string | null;
    created_at: string;
  },
  index: number
): ForestNode | null {
  const content = message.content ?? "";
  const type = detectType(content, message.created_at, message.message_type ?? "text");
  
  if (type === "ignore") return null;

  const position = idToPosition(message.id, index);
  const scale = detectScale(content, type);
  const colorVariant = hashStr(message.id + "color");
  const rotation = hashStr(message.id + "rot") * Math.PI * 2;
  const hour = new Date(message.created_at).getHours();
  const isNight = hour >= 21 || hour <= 5;

  return {
    id: message.id + "_node",
    messageId: message.id,
    type,
    position,
    scale,
    colorVariant,
    rotation,
    hasFireflies: isNight && (type === "pine" || type === "redwood" || type === "cherry"),
    hasPetals: type === "cherry",
    senderId: message.user_id,
    content,
    preview: content.length > 60 ? content.slice(0, 57) + "…" : content,
    createdAt: message.created_at,
    senderName: message.username,
  };
}
