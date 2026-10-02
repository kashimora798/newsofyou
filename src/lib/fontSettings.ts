export type MessageFontSize = "small" | "medium" | "large";

export const FONT_SIZE_STORAGE_KEY = "app_font_size";
export const HANDWRITING_FONT_STORAGE_KEY = "app_use_handwriting_font";

export function getSavedFontSize(): string {
  try {
    return localStorage.getItem(FONT_SIZE_STORAGE_KEY) || "medium";
  } catch {
    return "medium";
  }
}

export function getSavedHandwritingPreference(): boolean {
  try {
    return localStorage.getItem(HANDWRITING_FONT_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Returns Tailwind typography classes adapted for font size and font family.
 * Handwriting fonts naturally render with thinner strokes and slightly smaller glyph bounds,
 * so we subtly scale the px size for optimal readability.
 */
export function getMessageFontSizeClass(fontSize: string = "medium", isHandwriting: boolean = false): string {
  if (isHandwriting) {
    switch (fontSize) {
      case "small":
        return "text-[15px] leading-relaxed";
      case "large":
        return "text-[19.5px] leading-relaxed";
      case "medium":
      default:
        return "text-[17px] leading-relaxed";
    }
  }

  switch (fontSize) {
    case "small":
      return "text-[13px] leading-relaxed";
    case "large":
      return "text-[17px] leading-relaxed";
    case "medium":
    default:
      return "text-[14.5px] leading-relaxed";
  }
}
