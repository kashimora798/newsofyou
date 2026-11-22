import { describe, expect, it } from "vitest";
import {
  CONTENT_H, MAX_BLOCK_LINES, buildBlocks, buildHighlighter, chunkText, dayKeyOf, groupByMonth, monthCells, normalizeStyle,
  ordinalWord, paginate, seeded, summarizeDays, wrapLines, type Block,
} from "@/lib/journal";

const ME = "u-me";
const mk = (over: Record<string, unknown>) =>
  ({
    id: Math.random().toString(36).slice(2),
    user_id: ME,
    username: "Me",
    content: null,
    message_type: "text",
    created_at: "2026-03-03T10:00:00",
    is_memory: false,
    emoji: null,
    image_url: null,
    video: false,
    vidUrl: null,
    file_url: null,
    gif_url: null,
    sticker_url: null,
    ...over,
  }) as any;

const none = buildHighlighter([], []);
const opts = { dayKey: "2026-03-03", currentUserId: ME, highlighter: none };

describe("journal text layout", () => {
  it("wraps words and breaks over-long tokens", () => {
    expect(wrapLines("hello world", 20)).toEqual(["hello world"]);
    expect(wrapLines("a".repeat(50), 20)).toHaveLength(3);
    expect(wrapLines("one\n\ntwo", 20)).toEqual(["one", "", "two"]);
  });

  it("chunks very long messages so no block exceeds the cap", () => {
    const chunks = chunkText("lorem ipsum ".repeat(200));
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(wrapLines(c).length).toBeLessThanOrEqual(MAX_BLOCK_LINES + 1);
  });
});

describe("buildBlocks", () => {
  it("merges consecutive messages from one sender into a single run", () => {
    const blocks = buildBlocks([mk({ content: "hi" }), mk({ content: "how are you" }), mk({ content: "hey!", user_id: "u-her" })], opts);
    expect(blocks.map((b) => b.kind)).toEqual(["text", "text"]);
    expect((blocks[0] as any).entries).toHaveLength(2);
  });

  it("maps media types and skips game / reaction noise", () => {
    const blocks = buildBlocks(
      [
        mk({ message_type: "image", image_url: "https://x/a.jpg" }),
        mk({ message_type: "gif", gif_url: "https://x/a.gif" }),
        mk({ message_type: "voice_note", file_url: "https://x/a.webm", duration: 7 }),
        mk({ message_type: "coinflip", content: "heads" }),
        mk({ message_type: "secret", content: "shh" }),
        mk({ isReact: true, content: "❤️" }),
      ],
      opts,
    );
    expect(blocks.map((b) => b.kind)).toEqual(["photo", "gif", "audio"]);
  });

  it("folds album rows into one collage block", () => {
    const album = (i: number) => mk({ message_type: "image", image_url: `https://x/${i}.jpg`, emoji: { album: "A1", i, n: 3 } });
    const blocks = buildBlocks([album(0), album(1), album(2)], opts);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe("album");
  });

  it("is deterministic: same day → same decorations", () => {
    const msgs = [mk({ id: "m1", message_type: "image", image_url: "https://x/a.jpg" })];
    const a = buildBlocks(msgs, opts)[0];
    const b = buildBlocks(msgs, opts)[0];
    expect(a.rot).toBe(b.rot);
    expect(a.align).toBe(b.align);
  });

  it("highlights messages from bookmarks, is_memory and AI facts", () => {
    const h = buildHighlighter([{ fact: "She loves mango lassi on hot days", created_at: "" }], [{ message_id: "b1", category: "gift_ideas", note: "buy it" }]);
    const blocks = buildBlocks(
      [
        mk({ id: "b1", content: "that scarf would be a perfect gift" }),
        mk({ id: "m2", content: "she loves mango lassi on hot days", user_id: "x" }),
        mk({ id: "m3", content: "plain chatter", is_memory: true }),
        mk({ id: "m4", content: "nothing special here", user_id: "y" }),
      ],
      { ...opts, highlighter: h },
    );
    const flags = blocks.flatMap((b) => (b.kind === "text" ? b.entries.map((e) => e.highlight?.kind ?? null) : []));
    expect(flags).toEqual(["bookmark", "memory", "memory", null]);
  });
});

describe("paginate", () => {
  it("never overflows a page and keeps order", () => {
    const msgs = Array.from({ length: 120 }, (_, i) =>
      mk({ id: `m${i}`, content: `message number ${i} with some words to fill the line`, user_id: i % 3 === 0 ? "u-her" : ME }),
    );
    msgs.splice(10, 0, mk({ message_type: "image", image_url: "https://x/1.jpg" }), mk({ message_type: "voice_note", file_url: "https://x/v.webm" }));
    const blocks = buildBlocks(msgs, opts);
    const pages = paginate(blocks);
    expect(pages.length).toBeGreaterThan(2);
    pages.forEach((p, i) => {
      const used = p.blocks.reduce((a, b) => a + b.height, 0);
      expect(used).toBeLessThanOrEqual(i === 0 ? CONTENT_H - 168 : CONTENT_H);
    });
    expect(pages.flatMap((p) => p.blocks).length).toBe(blocks.length);
    expect(pages[0].isFirst).toBe(true);
  });

  it("gives every day at least one page", () => {
    expect(paginate([])).toHaveLength(1);
  });

  it("does not mutate input blocks", () => {
    const blocks = buildBlocks(Array.from({ length: 40 }, (_, i) => mk({ id: `x${i}`, content: "long ".repeat(40) })), opts);
    const before = JSON.stringify(blocks);
    paginate(blocks);
    expect(JSON.stringify(blocks)).toBe(before);
  });
});

describe("index helpers", () => {
  it("summarises days and groups months", () => {
    const days = summarizeDays([
      { created_at: "2026-03-03T09:00:00", message_type: "text", image_url: null },
      { created_at: "2026-03-03T10:00:00", message_type: "image", image_url: "u" },
      { created_at: "2026-03-03T11:00:00", message_type: "touch_reaction", image_url: null },
      { created_at: "2026-04-01T11:00:00", message_type: "voice_note", image_url: null },
    ]);
    expect(days).toEqual([
      { key: "2026-03-03", count: 2, photos: 1, audio: 0 },
      { key: "2026-04-01", count: 1, photos: 0, audio: 1 },
    ]);
    const months = groupByMonth(days);
    expect(months.map((m) => [m.label, m.count])).toEqual([["March", 2], ["April", 1]]);
  });

  it("builds calendar cells with leading blanks", () => {
    const cells = monthCells(2026, 2); // March 2026 starts on Sunday
    expect(cells[0]).toBe("2026-03-01");
    expect(cells).toHaveLength(31);
    expect(monthCells(2026, 3)[0]).toBeNull(); // April starts Wednesday
  });

  it("normalises untrusted style rows", () => {
    const s = normalizeStyle({ accent: "nope", paper: "kraft", emojis: ["🌷", 3, "💌"], title: "  hi  " });
    expect(s.accent).toBe("rose");
    expect(s.paper).toBe("kraft");
    expect(s.emojis).toEqual(["🌷", "💌"]);
    expect(s.title).toBe("hi");
  });

  it("misc: ordinal words, seeded rng, day keys", () => {
    expect(ordinalWord(3)).toBe("third");
    expect(seeded("a")()).toBe(seeded("a")());
    expect(dayKeyOf(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});
