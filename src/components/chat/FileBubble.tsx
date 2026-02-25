import React from "react";
import { Download } from "lucide-react";
import { formatFileSize, getFileIcon, getFileExtension } from "@/lib/fileUtils";

interface FileBubbleProps {
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

const FileBubble: React.FC<FileBubbleProps> = ({ fileUrl, fileName, fileType, fileSize }) => {
  const { icon } = getFileIcon(fileType);
  const ext = getFileExtension(fileName);

  return (
    <a
      href={fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/50 hover:bg-muted transition-colors group"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-lg shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{fileName}</p>
        <p className="text-[10px] text-muted-foreground">
          {ext} • {formatFileSize(fileSize)}
        </p>
      </div>
      <Download className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
    </a>
  );
};

export default FileBubble;
