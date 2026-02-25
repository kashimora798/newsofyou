import React from "react";

const URL_REGEX = /(https?:\/\/[^\s]+)/g;
const BOLD_REGEX = /\*([^*]+)\*/g;
const ITALIC_REGEX = /_([^_]+)_/g;
const STRIKE_REGEX = /~([^~]+)~/g;
const CODE_BLOCK_REGEX = /```([\s\S]*?)```/g;
const CODE_INLINE_REGEX = /`([^`]+)`/g;

export function formatMessageContent(text: string): React.ReactNode[] {
  // First handle code blocks
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const codeBlockRegex = new RegExp(CODE_BLOCK_REGEX.source, "g");
  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(...formatInline(text.slice(lastIndex, match.index)));
    }
    parts.push(
      <pre key={`cb-${match.index}`} className="bg-muted rounded-lg p-2 my-1 text-xs overflow-x-auto font-mono">
        <code>{match[1].trim()}</code>
      </pre>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(...formatInline(text.slice(lastIndex)));
  }
  return parts;
}

function formatInline(text: string): React.ReactNode[] {
  // Split by URLs first, then apply formatting
  const urlParts = text.split(URL_REGEX);
  const nodes: React.ReactNode[] = [];

  urlParts.forEach((part, i) => {
    if (URL_REGEX.test(part)) {
      nodes.push(
        <a
          key={`url-${i}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:opacity-80 break-all"
        >
          {part}
        </a>
      );
    } else {
      // Apply inline formatting
      let formatted = part;
      const elements: React.ReactNode[] = [];
      
      // Simple approach: apply replacements
      const codeInline = new RegExp(CODE_INLINE_REGEX.source, "g");
      let codeLastIdx = 0;
      let codeMatch: RegExpExecArray | null;
      
      while ((codeMatch = codeInline.exec(formatted)) !== null) {
        if (codeMatch.index > codeLastIdx) {
          elements.push(...applyTextFormatting(formatted.slice(codeLastIdx, codeMatch.index), `${i}-${codeLastIdx}`));
        }
        elements.push(
          <code key={`ic-${i}-${codeMatch.index}`} className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
            {codeMatch[1]}
          </code>
        );
        codeLastIdx = codeMatch.index + codeMatch[0].length;
      }
      if (codeLastIdx < formatted.length) {
        elements.push(...applyTextFormatting(formatted.slice(codeLastIdx), `${i}-end`));
      }
      nodes.push(...elements);
    }
  });

  return nodes;
}

function applyTextFormatting(text: string, keyPrefix: string): React.ReactNode[] {
  let result = text;
  const nodes: React.ReactNode[] = [];
  
  // Apply bold, italic, strikethrough via simple replacement
  result = result
    .replace(BOLD_REGEX, "⟨b⟩$1⟨/b⟩")
    .replace(ITALIC_REGEX, "⟨i⟩$1⟨/i⟩")
    .replace(STRIKE_REGEX, "⟨s⟩$1⟨/s⟩");

  // Parse the custom tags
  const tagRegex = /⟨(b|i|s)⟩(.*?)⟨\/(b|i|s)⟩/g;
  let lastIdx = 0;
  let tagMatch: RegExpExecArray | null;

  while ((tagMatch = tagRegex.exec(result)) !== null) {
    if (tagMatch.index > lastIdx) {
      nodes.push(<React.Fragment key={`${keyPrefix}-t${lastIdx}`}>{result.slice(lastIdx, tagMatch.index)}</React.Fragment>);
    }
    const tag = tagMatch[1];
    const content = tagMatch[2];
    if (tag === "b") nodes.push(<strong key={`${keyPrefix}-b${tagMatch.index}`}>{content}</strong>);
    else if (tag === "i") nodes.push(<em key={`${keyPrefix}-i${tagMatch.index}`}>{content}</em>);
    else if (tag === "s") nodes.push(<s key={`${keyPrefix}-s${tagMatch.index}`}>{content}</s>);
    lastIdx = tagMatch.index + tagMatch[0].length;
  }
  if (lastIdx < result.length) {
    nodes.push(<React.Fragment key={`${keyPrefix}-rest`}>{result.slice(lastIdx)}</React.Fragment>);
  }
  return nodes.length > 0 ? nodes : [<React.Fragment key={keyPrefix}>{text}</React.Fragment>];
}
