import { describe, it, expect } from "vitest";
import { countPdfPages, isPdf } from "@/lib/pdfMeta";

/**
 * A tiny but real PDF: pages declared as `/Type /Page` objects and a page tree
 * with `/Count`. That is all the counter reads.
 */
function pdfFixture(pages: number): Blob {
  const objects: string[] = ["%PDF-1.4\n"];
  const kids = Array.from({ length: pages }, (_, i) => `${i + 3} 0 R`).join(" ");
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pages} >>\nendobj\n`);
  for (let i = 0; i < pages; i++) {
    objects.push(`${i + 3} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>\nendobj\n`);
  }
  objects.push("trailer\n<< /Root 1 0 R >>\n%%EOF\n");
  return new Blob([objects.join("")], { type: "application/pdf" });
}

describe("countPdfPages", () => {
  it("counts the pages of an ordinary PDF", async () => {
    expect(await countPdfPages(pdfFixture(1))).toBe(1);
    expect(await countPdfPages(pdfFixture(2))).toBe(2);
    expect(await countPdfPages(pdfFixture(17))).toBe(17);
  });

  it("reads the page tree when the page objects are not in view", async () => {
    const treeOnly = new Blob(["%PDF-1.5\n2 0 obj\n<< /Type /Pages /Count 9 >>\nendobj\n%%EOF"], { type: "application/pdf" });
    expect(await countPdfPages(treeOnly)).toBe(9);
  });

  it("says nothing rather than guessing", async () => {
    expect(await countPdfPages(new Blob(["not a pdf at all"], { type: "application/pdf" }))).toBeNull();
    expect(await countPdfPages(new Blob([]))).toBeNull();
  });
});

describe("isPdf", () => {
  it("goes by type or by name", () => {
    expect(isPdf("application/pdf", "anything")).toBe(true);
    expect(isPdf("", "Scanned_20260926-1945.PDF")).toBe(true);
    expect(isPdf("image/webp", "photo.webp")).toBe(false);
  });
});
