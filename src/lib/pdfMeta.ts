/**
 * pdfMeta.ts — "2 pages" without shipping a PDF engine.
 *
 * A PDF's page tree is plain text even when its content streams are compressed,
 * so the count can be read straight out of the bytes. We scan the head and the
 * tail (the page tree is usually at the end), count both the `/Type /Page`
 * entries and the `/Count` on the page tree, and take the largest sensible
 * answer.
 *
 * This is a heuristic — a weird file can come back `null`, which simply means
 * the card shows "1.1 MB • PDF" without the page count. Nothing is uploaded to
 * find it out; the file never leaves the device.
 */

/** How much of each end of the file to read. */
const HEAD_BYTES = 512 * 1024;
const TAIL_BYTES = 512 * 1024;

const latin1 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let out = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return out;
};

/** Count `/Type /Page` (not `/Pages`) — the actual page objects. */
function countPageObjects(text: string): number {
  const matches = text.match(/\/Type\s*\/Page(?![s])/g);
  return matches ? matches.length : 0;
}

/** `/Count 12` on the page tree — present even with object streams. */
function countFromPageTree(text: string): number {
  let best = 0;
  const re = /\/Count\s+(\d{1,6})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > best && n < 100000) best = n;
  }
  return best;
}

/** Page count, or null when it cannot be told. Never throws. */
export async function countPdfPages(file: Blob): Promise<number | null> {
  try {
    const size = file.size;
    const headEnd = Math.min(size, HEAD_BYTES);
    const tailStart = Math.max(0, size - TAIL_BYTES);

    const [head, tail] = await Promise.all([
      file.slice(0, headEnd).arrayBuffer(),
      tailStart > 0 ? file.slice(tailStart, size).arrayBuffer() : Promise.resolve(new ArrayBuffer(0)),
    ]);

    const headText = latin1(head);
    const tailText = latin1(tail);

    // A linearised PDF puts the page objects up front; a normal one hides them
    // at the back, and the page tree's /Count is often at the very end.
    const pageObjects = countPageObjects(headText) + countPageObjects(tailText);
    const fromTree = Math.max(countFromPageTree(headText), countFromPageTree(tailText));

    if (pageObjects > 0 && fromTree > 0) return Math.min(pageObjects, fromTree) || fromTree;
    if (pageObjects > 0) return pageObjects;
    if (fromTree > 0) return fromTree;
    return null;
  } catch {
    return null;
  }
}

/** Is this a PDF at all? */
export function isPdf(fileType?: string | null, fileName?: string | null): boolean {
  const type = String(fileType ?? "").toLowerCase();
  if (type.includes("pdf")) return true;
  return /\.pdf$/i.test(String(fileName ?? ""));
}
