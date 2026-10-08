import React from "react";
import { Download, FileText } from "lucide-react";
import { documentStyle, documentSubtitle, isImageFile } from "@/lib/chatMedia";

/**
 * FileBubble — a document in the chat, drawn as a card.
 *
 * The shape is the familiar one: a coloured block with the file's own label on
 * the left, the filename in bold, the facts underneath ("2 pages • 1.1 MB •
 * PDF"), and a download arrow. The page count is read from the PDF's own bytes
 * on the sender's device (see `src/lib/pdfMeta.ts`), so nothing is uploaded to
 * find it out and the card still says it after a reload.
 */

interface FileBubbleProps {
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  /** From `chat_attachments`, when the sender's device could tell. */
  pages?: number | null;
  /** The small sibling image, shown as a thumbnail when there is one. */
  previewUrl?: string | null;
}

const FileBubble: React.FC<FileBubbleProps> = ({ fileUrl, fileName, fileType, fileSize, pages, previewUrl }) => {
  const style = documentStyle(fileType, fileName);
  const subtitle = documentSubtitle({ pages, bytes: fileSize, fileName, fileType });
  const thumbnail = previewUrl && isImageFile(fileType, fileName) ? previewUrl : null;

  return (
    <a
      href={fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      download={fileName}
      className="group flex items-center gap-2.5 rounded-xl bg-black/10 p-2 transition-colors hover:bg-black/15 dark:bg-white/5 dark:hover:bg-white/10"
      style={{ minWidth: 200, maxWidth: 280 }}
    >
      {/* the label block — a thumbnail when we have one, the file's colour otherwise */}
      <span
        className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg text-[10.5px] font-bold tracking-wide"
        style={thumbnail ? undefined : { background: style.bg, color: style.fg }}
      >
        {thumbnail ? (
          <img src={thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : style.label === "PDF" ? (
          <span className="flex flex-col items-center leading-none">
            <FileText className="mb-0.5 h-4 w-4" />
            PDF
          </span>
        ) : (
          style.label
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium leading-tight">{fileName}</span>
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{subtitle}</span>
      </span>

      <Download className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
    </a>
  );
};

export default FileBubble;
