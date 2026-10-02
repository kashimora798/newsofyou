import React from "react";

export type MessageFontSize = "small" | "medium" | "large";

export const FONT_SIZE_STORAGE_KEY = "app_font_size";
export const HANDWRITING_FONT_STORAGE_KEY = "app_use_handwriting_font";
export const CUSTOM_FONT_SIZE_STORAGE_KEY = "app_custom_font_size";

export const DEFAULT_CUSTOM_FONT_SIZE_PX = 20;
export const DEFAULT_CUSTOM_FONT_SIZE_STR = "20px";
export const CUSTOM_FONT_SIZE_PRESETS = ["16px", "18px", "20px", "22px", "24px", "26px"] as const;

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

export function getSavedCustomFontSize(): string {
  try {
    const val = localStorage.getItem(CUSTOM_FONT_SIZE_STORAGE_KEY);
    if (!val) return DEFAULT_CUSTOM_FONT_SIZE_STR;
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 12 || num > 36) return DEFAULT_CUSTOM_FONT_SIZE_STR;
    return `${num}px`;
  } catch {
    return DEFAULT_CUSTOM_FONT_SIZE_STR;
  }
}

export function parseCustomFontSizeNumber(size?: string | number): number {
  if (typeof size === "number") {
    return size >= 12 && size <= 36 ? size : DEFAULT_CUSTOM_FONT_SIZE_PX;
  }
  if (!size) return DEFAULT_CUSTOM_FONT_SIZE_PX;
  const num = parseInt(size, 10);
  return isNaN(num) || num < 12 || num > 36 ? DEFAULT_CUSTOM_FONT_SIZE_PX : num;
}

export function getMessageFontStyle(
  isHandwriting: boolean,
  customFontSize?: string | number
): React.CSSProperties | undefined {
  if (!isHandwriting) return undefined;
  const px = parseCustomFontSizeNumber(customFontSize);
  return {
    fontSize: `${px}px`,
    lineHeight: "1.4",
  };
}

/**
 * Returns Tailwind typography classes adapted for standard font size and font family fallback.
 */
export function getMessageFontSizeClass(fontSize: string = "medium", isHandwriting: boolean = false): string {
  if (isHandwriting) {
    // When custom font is used, inline style sets the exact px size,
    // while this utility provides the leading line-height.
    return "leading-relaxed";
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
