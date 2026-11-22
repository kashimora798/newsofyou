import { describe, it, expect } from "vitest";
import { groupMessages, jumboEmojiCount, getAlbumMeta } from "@/lib/album";

const msg = (id: string, over: Record<string, unknown> = {}) =>
  ({ id, user_id: "u1", message_type: "text", emoji: null, content: "hi", created_at: "2026-11-01T10:00:00Z", ...over }) as any;

describe("groupMessages", () => {
  it("folds album rows into one item, ordered by index", () => {
    const rows = [
      msg("a", { message_type: "image", emoji: { album: "X", i: 1, n: 3 } }),
      msg("b", { message_type: "image", emoji: { album: "X", i: 0, n: 3 } }),
      msg("c", { message_type: "image", emoji: { album: "X", i: 2, n: 3 } }),
      msg("d"),
    ];
    const items = groupMessages(rows);
    expect(items).toHaveLength(2);
    expect(items[0].kind).toBe("album");
    if (items[0].kind === "album") {
      expect(items[0].messages.map((m) => m.id)).toEqual(["b", "a", "c"]);
      expect(items[0].last.id).toBe("c");
    }
  });

  it("does not merge different albums or senders", () => {
    const items = groupMessages([
      msg("a", { message_type: "image", emoji: { album: "X", i: 0, n: 2 } }),
      msg("b", { message_type: "image", emoji: { album: "Y", i: 0, n: 2 } }),
      msg("c", { message_type: "image", user_id: "u2", emoji: { album: "Y", i: 1, n: 2 } }),
    ]);
    expect(items).toHaveLength(3);
  });

  it("leaves plain images and letters (which also use `emoji`) alone", () => {
    expect(getAlbumMeta(msg("a", { message_type: "image" }))).toBeNull();
    expect(getAlbumMeta(msg("a", { message_type: "letter", emoji: { letter_paper: 1 } }))).toBeNull();
  });
});

describe("jumboEmojiCount", () => {
  it("detects 1–3 emoji only", () => {
    expect(jumboEmojiCount("😂")).toBe(1);
    expect(jumboEmojiCount("❤️❤️")).toBe(2);
    expect(jumboEmojiCount("👍🏽")).toBe(1);
    expect(jumboEmojiCount("😂😂😂😂")).toBe(0);
    expect(jumboEmojiCount("hi 😂")).toBe(0);
    expect(jumboEmojiCount("")).toBe(0);
  });
});
