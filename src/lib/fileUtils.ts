export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
}

export function getFileIcon(mimeType: string): { icon: string; color: string } {
  if (mimeType.includes("pdf")) return { icon: "📄", color: "text-red-500" };
  if (mimeType.includes("word") || mimeType.includes("doc")) return { icon: "📝", color: "text-blue-500" };
  if (mimeType.includes("sheet") || mimeType.includes("excel") || mimeType.includes("csv")) return { icon: "📊", color: "text-green-500" };
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return { icon: "📑", color: "text-orange-500" };
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("tar") || mimeType.includes("compress")) return { icon: "📦", color: "text-yellow-500" };
  if (mimeType.includes("audio")) return { icon: "🎵", color: "text-purple-500" };
  if (mimeType.includes("text")) return { icon: "📃", color: "text-muted-foreground" };
  return { icon: "📎", color: "text-muted-foreground" };
}

export function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toUpperCase() ?? "FILE";
}
