import { describe, it, expect } from "vitest";
import { pickOutputType } from "@/lib/media";

/** A canvas that claims to encode exactly the type it is asked for. */
const canvasThatSupports = (...types: string[]) => ({
  toDataURL: (type?: string) =>
    types.includes(String(type)) ? `data:${type};base64,AAAA` : "data:image/png;base64,AAAA",
});

describe("pickOutputType", () => {
  it("takes WebP when the browser has it", () => {
    expect(pickOutputType(canvasThatSupports("image/webp", "image/png"), undefined)).toBe("image/webp");
  });

  it("falls back to JPEG when WebP is refused — never a bigger file", () => {
    expect(pickOutputType(canvasThatSupports("image/jpeg"), undefined)).toBe("image/jpeg");
  });

  it("honours a PNG request, because a sticker's transparency must survive", () => {
    expect(pickOutputType(canvasThatSupports("image/png"), "image/png")).toBe("image/png");
  });

  it("keeps PNG even on a browser that silently answers with a PNG anyway", () => {
    // Safari-as-it-is: asked for PNG, gives PNG.
    expect(pickOutputType(canvasThatSupports("image/png", "image/jpeg"), "image/png")).toBe("image/png");
  });

  it("never returns JPEG for a PNG request, and never throws", () => {
    const broken = {
      toDataURL: () => {
        throw new Error("no canvas here");
      },
    };
    expect(pickOutputType(broken, "image/png")).toBe("image/png");
    expect(pickOutputType(broken, undefined)).toBe("image/jpeg");
  });
});
