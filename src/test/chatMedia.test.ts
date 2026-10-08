import { describe, it, expect } from "vitest";
import {
  albumLayout,
  attachmentPath,
  documentStyle,
  documentSubtitle,
  groupImageAlbums,
  isAlbumable,
  isImageFile,
  thumbPathFor,
  thumbUrlFor,
} from "@/lib/chatMedia";

/** A minimal `messages` row — only the fields the layout actually reads. */
const msg = (over: Partial<Record<string, unknown>> = {}) =>
  ({
    id: "m1",
    user_id: "u1",
    content: "",
    message_type: "image",
    image_url: "https://example.supabase.co/storage/v1/object/public/chat-images/a.webp",
    created_at: "2026-10-08T18:00:00.000Z",
    ...over,
  }) as never;

describe("album grouping", () => {
  it("keeps a single photo as an ordinary message", () => {
    const items = groupImageAlbums([msg()]);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("message");
  });

  it("draws photos sent back to back as one cluster", () => {
    const items = groupImageAlbums([
      msg({ id: "a", created_at: "2026-10-08T18:00:00.000Z" }),
      msg({ id: "b", created_at: "2026-10-08T18:00:20.000Z" }),
      msg({ id: "c", created_at: "2026-10-08T18:01:00.000Z" }),
      msg({ id: "d", created_at: "2026-10-08T18:02:30.000Z" }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("album");
    if (items[0].kind === "album") expect(items[0].messages.map((m) => m.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("breaks the run on a caption, a reply, another sender or a long pause", () => {
    const caption = groupImageAlbums([
      msg({ id: "a" }),
      msg({ id: "b", content: "look at this" }),
      msg({ id: "c" }),
    ]);
    expect(caption.map((i) => i.kind)).toEqual(["message", "message", "message"]);

    const other = groupImageAlbums([
      msg({ id: "a" }),
      msg({ id: "b", user_id: "u2" }),
    ]);
    expect(other.map((i) => i.kind)).toEqual(["message", "message"]);

    const late = groupImageAlbums([
      msg({ id: "a", created_at: "2026-10-08T18:00:00.000Z" }),
      msg({ id: "b", created_at: "2026-10-08T18:05:00.000Z" }),
    ]);
    expect(late.map((i) => i.kind)).toEqual(["message", "message"]);
  });

  it("never puts more than the cap in one album", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      msg({ id: `m${i}`, created_at: new Date(Date.parse("2026-10-08T18:00:00.000Z") + i * 1000).toISOString() }),
    );
    const items = groupImageAlbums(many);
    expect(items).toHaveLength(2);
    expect(items[0].kind).toBe("album");
    expect(items[1].kind).toBe("album");
    if (items[0].kind === "album") expect(items[0].messages).toHaveLength(10);
    if (items[1].kind === "album") expect(items[1].messages).toHaveLength(2);
  });

  it("treats a video or a document as its own bubble", () => {
    expect(isAlbumable(msg({ message_type: "video" }))).toBe(false);
    expect(isAlbumable(msg({ message_type: "file", image_url: null }))).toBe(false);
    expect(isAlbumable(msg())).toBe(true);
  });
});

describe("album geometry", () => {
  it("puts two side by side, a wide pair", () => {
    const layout = albumLayout(2);
    expect(layout.aspectClass).toBe("aspect-[2/1]");
    expect(layout.gridClass).toBe("grid-cols-2 grid-rows-1");
    expect(layout.tiles).toHaveLength(2);
    expect(layout.hidden).toBe(0);
  });

  it("makes three a square with the first tile tall", () => {
    const layout = albumLayout(3);
    expect(layout.aspectClass).toBe("aspect-square");
    expect(layout.tiles[0].className).toBe("row-span-2");
    expect(layout.tiles.map((t) => t.className)).toEqual(["row-span-2", "", ""]);
  });

  it("shows four tiles and counts the rest behind a +N", () => {
    const four = albumLayout(4);
    expect(four.tiles).toHaveLength(4);
    expect(four.tiles.every((t) => !t.overlay)).toBe(true);

    const six = albumLayout(6);
    expect(six.tiles).toHaveLength(4);
    expect(six.hidden).toBe(2);
    expect(six.tiles[3].overlay).toBe("+2");
  });
});

describe("attachment details", () => {
  it("finds the storage object behind a public URL", () => {
    expect(
      attachmentPath("https://x.supabase.co/storage/v1/object/public/chat-images/u1/1728-photo%20one.webp?token=abc"),
    ).toBe("1728-photo one.webp");
    expect(attachmentPath(null)).toBeNull();
    expect(attachmentPath("")).toBeNull();
  });

  it("names the preview sibling next to the master", () => {
    expect(thumbPathFor("u1/1728-photo.webp")).toBe("u1/1728-photo.thumb.webp");
    expect(thumbUrlFor("https://x/chat-images/u1/1728-photo.webp")).toBe("https://x/chat-images/u1/1728-photo.thumb.webp");
    expect(thumbUrlFor("https://x/documents/u1/scanned.pdf")).toBeNull();
  });

  it("colours a document by what it is", () => {
    expect(documentStyle("application/pdf", "Scanned.pdf").label).toBe("PDF");
    expect(documentStyle("application/pdf", "Scanned.pdf").bg).toBe("#e8503a");
    expect(documentStyle("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Essay.docx").label).toBe("DOCX");
    expect(documentStyle("application/vnd.ms-excel", "Marks.xls").bg).toBe("#1f7244");
    expect(documentStyle("application/zip", "Photos.zip").bg).toBe("#8a6d1f");
    expect(documentStyle("", "notes.txt").label).toBe("TXT");
  });

  it("writes the subtitle the way a document card should read", () => {
    expect(documentSubtitle({ pages: 2, bytes: 1153433.6, fileName: "Scanned.pdf", fileType: "application/pdf" })).toBe(
      "2 pages • 1.2 MB • PDF",
    );
    // `humanBytes` is decimal and rounds (20480 B = 20.48 KB → "20 KB").
    expect(documentSubtitle({ pages: 1, bytes: 20480, fileName: "note.pdf", fileType: "application/pdf" })).toBe(
      "1 page • 20 KB • PDF",
    );
    expect(documentSubtitle({ pages: null, bytes: 900000, fileName: "sheet.xlsx", fileType: "" })).toBe("900 KB • XLSX");
    expect(documentSubtitle({ fileName: "mystery", fileType: "" })).toBe("file");
  });

  it("knows a photo when it sees one", () => {
    expect(isImageFile("image/webp", "a.webp")).toBe(true);
    expect(isImageFile("", "IMG_0042.HEIC")).toBe(true);
    expect(isImageFile("application/pdf", "a.pdf")).toBe(false);
  });
});
