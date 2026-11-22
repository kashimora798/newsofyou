import React from "react";
import { Paperclip, Star as StarIcon } from "lucide-react";
import {
  ACCENTS, CONTENT_H, HEADER_H, LINE_H, PAGE_H, PAGE_PAD_BOTTOM, PAGE_PAD_TOP, PAGE_PAD_X, PAGE_W, PHOTO_VARIANTS,
  describeDay, rememberHeight, seeded, type Block, type JournalDayStyle, type JournalPage as JPage, MOODS, WASHI, type WashiKey,
} from "@/lib/journal";
import { DOODLES, Washi } from "./Decor";
import TapeRecorder from "./TapeRecorder";

export interface DayContext {
  dayKey: string;
  style: JournalDayStyle;
  /** facts from the remember tables that belong to this day */
  facts: string[];
  messageCount: number;
  photoCount: number;
}

export function reservedForFirstPage(ctx: DayContext) {
  return HEADER_H + rememberHeight(Math.min(ctx.facts.length, 3));
}

const HAND = "Caveat, 'MyHandwriting', 'Comic Neue', cursive";
const TYPE = "'Special Elite', 'Courier New', monospace";
const SCRIPT = "'Kaushan Script', 'Pacifico', cursive";

const CASSETTE_COLORS = ["#f7b6c2", "#a5dad7", "#f5d780", "#c9b8ee", "#b4d8b8", "#f8c1aa"];

function paperStyle(paper: JournalDayStyle["paper"]): React.CSSProperties {
  const dot = "rgba(80,70,60,.28)";
  switch (paper) {
    case "dotted":
      return { backgroundColor: "#fffdf8", backgroundImage: `radial-gradient(circle, ${dot} 1px, transparent 1.4px)`, backgroundSize: "20px 20px", backgroundPosition: "10px 14px" };
    case "lined":
      return { backgroundColor: "#fffdf8", backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 25px, rgba(110,150,200,.28) 25px 26px)", backgroundPosition: `0 ${PAGE_PAD_TOP + 22}px` };
    case "grid":
      return { backgroundColor: "#fffdf8", backgroundImage: "linear-gradient(rgba(110,150,200,.2) 1px, transparent 1px), linear-gradient(90deg, rgba(110,150,200,.2) 1px, transparent 1px)", backgroundSize: "20px 20px" };
    case "kraft":
      return { backgroundColor: "#ecd9bb", backgroundImage: "radial-gradient(rgba(120,80,30,.12) 1px, transparent 1.2px)", backgroundSize: "7px 7px" };
    case "blush":
      return { backgroundColor: "#fdf0f0", backgroundImage: `radial-gradient(circle, rgba(200,80,100,.2) 1px, transparent 1.4px)`, backgroundSize: "20px 20px" };
    case "mint":
      return { backgroundColor: "#eff8f1", backgroundImage: `radial-gradient(circle, rgba(60,130,90,.22) 1px, transparent 1.4px)`, backgroundSize: "20px 20px" };
    case "night":
      return { backgroundColor: "#2b2d42", backgroundImage: "radial-gradient(circle, rgba(255,255,255,.28) 1px, transparent 1.3px)", backgroundSize: "26px 26px" };
    default:
      return { backgroundColor: "#fffcf5" };
  }
}

/* ───────────────────────── blocks ───────────────────────── */

const justify = (a: Block["align"]) => (a === "left" ? "flex-start" : a === "right" ? "flex-end" : "center");

const Wrap: React.FC<{ block: Block; children: React.ReactNode; rotate?: boolean }> = ({ block, children, rotate = true }) => (
  <div
    style={{ height: block.height, display: "flex", flexDirection: "column", alignItems: justify(block.align), justifyContent: "center", paddingInline: block.align === "center" ? 0 : 10 }}
  >
    <div style={{ transform: rotate ? `rotate(${block.rot}deg)` : undefined, display: "flex", flexDirection: "column", alignItems: "center" }}>{children}</div>
  </div>
);

interface BlockCtx {
  style: JournalDayStyle;
  dark: boolean;
  onOpenImage: (url: string) => void;
}

const Img: React.FC<{ url: string; w: number; h: number; onOpen: (u: string) => void; className?: string; style?: React.CSSProperties }> = ({ url, w, h, onOpen, className, style }) => (
  <img
    src={url}
    alt="shared moment"
    loading="lazy"
    decoding="async"
    draggable={false}
    onClick={() => onOpen(url)}
    className={`cursor-zoom-in bg-black/5 object-cover ${className ?? ""}`}
    style={{ width: w, height: h, ...style }}
  />
);

const Caption: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <p className="mt-1 line-clamp-1 max-w-[260px] text-center" style={{ fontFamily: HAND, fontSize: 19, lineHeight: "24px", color }}>
    {text}
  </p>
);

const PhotoBlock: React.FC<{ block: Extract<Block, { kind: "photo" }>; c: BlockCtx }> = ({ block, c }) => {
  const accent = ACCENTS[c.style.accent];
  const variant = PHOTO_VARIANTS[block.variant % PHOTO_VARIANTS.length];
  const star = block.highlight ? (
    <span className="absolute -right-2 -top-3 z-10 text-[22px] drop-shadow" style={{ transform: "rotate(14deg)" }} title="Remembered">{block.highlight.emoji}</span>
  ) : null;
  const capColor = c.dark ? "#f4efe6" : "#3b3646";
  let frame: React.ReactNode;

  if (variant === "polaroid") {
    frame = (
      <div className="relative bg-white" style={{ padding: "10px 10px 12px", boxShadow: "0 3px 8px rgba(40,30,20,.25)" }}>
        <Washi kind={c.style.washi} color={accent.tape} width={64} height={18} rot={-3} className="absolute -top-3 left-1/2 -ml-8 z-10" />
        <Img url={block.url} w={180} h={180} onOpen={c.onOpenImage} />
        <p className="pt-1.5 text-center" style={{ fontFamily: HAND, fontSize: 17, color: "#6b6275", height: 24 }}>{block.time}</p>
        {star}
      </div>
    );
  } else if (variant === "taped") {
    frame = (
      <div className="relative bg-white p-1.5" style={{ boxShadow: "0 3px 8px rgba(40,30,20,.25)" }}>
        <Washi kind={c.style.washi} color={accent.tape} width={58} height={18} rot={-35} className="absolute -left-4 -top-2 z-10" />
        <Washi kind={c.style.washi} color={accent.tape} width={58} height={18} rot={-35} className="absolute -bottom-2 -right-4 z-10" />
        <Img url={block.url} w={232} h={168} onOpen={c.onOpenImage} />
        {star}
      </div>
    );
  } else if (variant === "stamp") {
    frame = (
      <div className="relative bg-white" style={{ padding: 10, boxShadow: "0 3px 8px rgba(40,30,20,.25)", outline: `2px dashed ${accent.ink}`, outlineOffset: -5 }}>
        <Img url={block.url} w={150} h={190} onOpen={c.onOpenImage} />
        <svg width="54" height="54" viewBox="0 0 54 54" className="pointer-events-none absolute -bottom-3 -right-5 opacity-80" style={{ transform: "rotate(-14deg)" }}>
          <circle cx="27" cy="27" r="22" fill="none" stroke={accent.ink} strokeWidth="2" />
          <circle cx="27" cy="27" r="16" fill="none" stroke={accent.ink} strokeWidth="1" strokeDasharray="2 2" />
          <text x="27" y="31" textAnchor="middle" fontFamily="'Special Elite', monospace" fontSize="10" fill={accent.ink}>{block.time.replace(/(am|pm)/, "")}</text>
        </svg>
        {star}
      </div>
    );
  } else {
    frame = (
      <div className="relative" style={{ background: accent.soft, padding: 8, boxShadow: "0 3px 8px rgba(40,30,20,.22)" }}>
        <Img url={block.url} w={250} h={168} onOpen={c.onOpenImage}
          style={{ clipPath: "polygon(0 0,100% 0,100% 94%,94% 100%,86% 95%,77% 100%,67% 94%,57% 100%,46% 95%,36% 100%,26% 94%,16% 100%,7% 95%,0 100%)" }} />
        <Washi kind={c.style.washi} color={accent.tape} width={70} height={18} rot={4} className="absolute -top-3 left-1/2 -ml-9 z-10" />
        {star}
      </div>
    );
  }

  return (
    <Wrap block={block}>
      {frame}
      {block.caption && <Caption text={block.caption} color={capColor} />}
    </Wrap>
  );
};

const AlbumBlock: React.FC<{ block: Extract<Block, { kind: "album" }>; c: BlockCtx }> = ({ block, c }) => {
  const accent = ACCENTS[c.style.accent];
  const n = block.urls.length;
  const shadow = { boxShadow: "0 3px 8px rgba(40,30,20,.25)" };
  let body: React.ReactNode;
  if (n === 2) {
    body = (
      <div className="relative flex items-center" style={{ width: 300, height: 190 }}>
        {block.urls.map((u, i) => (
          <div key={u + i} className="absolute bg-white" style={{ padding: "8px 8px 24px", left: i * 120, top: i ? 10 : 0, transform: `rotate(${i ? 5 : -5}deg)`, ...shadow }}>
            <Img url={u} w={130} h={130} onOpen={c.onOpenImage} />
          </div>
        ))}
        <Washi kind={c.style.washi} color={accent.tape} width={60} height={18} rot={-8} className="absolute left-[118px] -top-2 z-10" />
      </div>
    );
  } else if (n === 3) {
    body = (
      <div className="relative bg-white p-1.5" style={{ width: 288, ...shadow }}>
        <div className="flex gap-1.5">
          <Img url={block.urls[0]} w={136} h={100} onOpen={c.onOpenImage} />
          <Img url={block.urls[1]} w={136} h={100} onOpen={c.onOpenImage} />
        </div>
        <Img url={block.urls[2]} w={276} h={112} onOpen={c.onOpenImage} className="mt-1.5" />
        <Washi kind={c.style.washi} color={accent.tape} width={70} height={18} rot={-3} className="absolute -top-3 left-1/2 -ml-9 z-10" />
      </div>
    );
  } else {
    body = (
      <div className="relative grid grid-cols-2 gap-2" style={{ width: 308 }}>
        {block.urls.map((u, i) => (
          <div key={u + i} className="bg-white p-1.5" style={{ transform: `rotate(${[-2.5, 2, 1.5, -2][i % 4]}deg)`, ...shadow }}>
            <Img url={u} w={134} h={112} onOpen={c.onOpenImage} />
          </div>
        ))}
        <Washi kind={c.style.washi} color={accent.tape} width={64} height={18} rot={-12} className="absolute left-1/2 top-1/2 -ml-8 -mt-2 z-10" />
      </div>
    );
  }
  return (
    <Wrap block={block} rotate={false}>
      {body}
      {block.caption && <Caption text={block.caption} color={c.dark ? "#f4efe6" : "#3b3646"} />}
    </Wrap>
  );
};

const GifBlock: React.FC<{ block: Extract<Block, { kind: "gif" }>; c: BlockCtx }> = ({ block, c }) => {
  const accent = ACCENTS[c.style.accent];
  return (
    <Wrap block={block}>
      <div className="relative bg-white p-1.5" style={{ boxShadow: "0 3px 8px rgba(40,30,20,.25)" }}>
        <Washi kind={c.style.washi} color={accent.tape} width={56} height={17} rot={-6} className="absolute -top-2.5 left-3 z-10" />
        <img src={block.url} alt="gif" loading="lazy" draggable={false} className="object-cover" style={{ width: 196, height: 150 }} />
        <span className="absolute bottom-3 right-3 rounded px-1.5 py-px text-[9px] font-bold tracking-wider text-white" style={{ background: accent.ink, fontFamily: TYPE }}>GIF</span>
      </div>
    </Wrap>
  );
};

const StickerBlock: React.FC<{ block: Extract<Block, { kind: "sticker" }> }> = ({ block }) => (
  <Wrap block={block}>
    <img
      src={block.url}
      alt="sticker"
      loading="lazy"
      draggable={false}
      style={{
        width: 96, height: 96, objectFit: "contain",
        filter: "drop-shadow(2px 0 0 #fff) drop-shadow(-2px 0 0 #fff) drop-shadow(0 2px 0 #fff) drop-shadow(0 -2px 0 #fff) drop-shadow(0 3px 3px rgba(0,0,0,.28))",
      }}
    />
  </Wrap>
);

const AudioBlock: React.FC<{ block: Extract<Block, { kind: "audio" }>; c: BlockCtx }> = ({ block, c }) => {
  const rnd = seeded(`audio:${block.id}`);
  const color = CASSETTE_COLORS[Math.floor(rnd() * CASSETTE_COLORS.length)];
  return (
    <Wrap block={block}>
      <TapeRecorder
        src={block.url}
        mime={block.mime}
        duration={block.duration}
        label={block.label}
        variant={block.variant % 2 === 0 ? "cassette" : "recorder"}
        color={color}
        mine={block.mine}
        time={block.time}
      />
    </Wrap>
  );
};

const VideoBlock: React.FC<{ block: Extract<Block, { kind: "video" }> }> = ({ block }) => {
  const holes = { backgroundImage: "radial-gradient(circle, #f4efe6 2.5px, transparent 3px)", backgroundSize: "14px 12px", backgroundRepeat: "repeat-x" } as const;
  return (
    <Wrap block={block}>
      <div className="bg-[#1d1a1a] px-1.5 py-1" style={{ boxShadow: "0 3px 8px rgba(40,30,20,.35)" }}>
        <div style={{ height: 12, ...holes }} />
        <video src={block.url} controls playsInline preload="metadata" className="block bg-black object-cover" style={{ width: 232, height: 136 }} />
        <div style={{ height: 12, ...holes }} />
      </div>
    </Wrap>
  );
};

const FileBlock: React.FC<{ block: Extract<Block, { kind: "file" }>; c: BlockCtx }> = ({ block, c }) => {
  const accent = ACCENTS[c.style.accent];
  return (
    <Wrap block={block}>
      <a href={block.url} target="_blank" rel="noreferrer" className="flex max-w-[270px] items-center gap-2 rounded-r-lg border border-dashed bg-white px-3 py-2"
        style={{ borderColor: accent.ink, fontFamily: TYPE, fontSize: 11, color: "#4a4256", boxShadow: "0 2px 5px rgba(40,30,20,.2)" }}>
        <Paperclip className="h-4 w-4 shrink-0" style={{ color: accent.ink }} />
        <span className="truncate">{block.name}</span>
      </a>
    </Wrap>
  );
};

const TextBlock: React.FC<{ block: Extract<Block, { kind: "text" }>; c: BlockCtx }> = ({ block, c }) => {
  const accent = ACCENTS[c.style.accent];
  const neutral = c.dark ? "#f4efe6" : "#2e2a3a";
  const ink = block.mine ? neutral : c.dark ? accent.tape : accent.ink;
  return (
    <div style={{ paddingBottom: 14 }}>
      {!block.cont && (
        <div className="flex items-center gap-1.5" style={{ height: 24, fontFamily: TYPE, fontSize: 10.5, letterSpacing: ".04em", color: ink, opacity: 0.85 }}>
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: block.mine ? accent.tape : accent.ink }} />
          <span className="uppercase">{block.name}</span>
          <span style={{ opacity: 0.6 }}>· {block.time}</span>
        </div>
      )}
      {block.entries.map((e, i) => (
        <p
          key={e.id}
          className="whitespace-pre-wrap break-words"
          style={{ fontFamily: HAND, fontSize: 21, lineHeight: `${LINE_H}px`, color: ink, marginTop: i ? 3 : 0, fontWeight: 500 }}
        >
          {e.highlight ? (
            <span
              title={e.highlight.note ?? "Remembered"}
              style={{ background: `linear-gradient(transparent 52%, ${accent.tape} 52% 92%, transparent 92%)`, padding: "0 2px", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}
            >
              {e.text}
              <span style={{ marginLeft: 4, fontSize: 15 }}>{e.highlight.emoji}</span>
            </span>
          ) : (
            e.text
          )}
        </p>
      ))}
    </div>
  );
};

/* ───────────────────────── header / remember note ───────────────────────── */

const DayHeader: React.FC<{ ctx: DayContext; dark: boolean }> = ({ ctx, dark }) => {
  const accent = ACCENTS[ctx.style.accent];
  const d = describeDay(ctx.dayKey);
  const mood = MOODS.find((m) => m.key === ctx.style.mood);
  const text = dark ? "#f4efe6" : "#2e2a3a";
  return (
    <div className="relative" style={{ height: HEADER_H }}>
      <div className="flex items-baseline justify-between" style={{ fontFamily: TYPE, color: accent.ink, fontSize: 12, letterSpacing: ".18em" }}>
        <span className="uppercase">{d.weekday}</span>
        <span style={{ opacity: 0.8 }}>{d.year}</span>
      </div>
      <div className="relative mt-0.5 flex items-end gap-2">
        <h2 className="leading-none" style={{ fontFamily: SCRIPT, fontSize: d.month.length > 7 ? 48 : 58, color: accent.ink, transform: "rotate(-3deg)", transformOrigin: "left bottom", textShadow: dark ? "none" : "1px 2px 0 rgba(255,255,255,.7)" }}>
          {d.month}
        </h2>
        <span className="mb-1 rounded-sm border border-dashed px-1.5 py-0.5" style={{ fontFamily: TYPE, fontSize: 12, color: text, borderColor: accent.ink, background: dark ? "transparent" : "rgba(255,255,255,.7)", transform: "rotate(2deg)" }}>
          {d.dateWord}
        </span>
      </div>
      {ctx.style.title && (
        <p className="mt-1.5 truncate" style={{ fontFamily: HAND, fontSize: 27, lineHeight: "30px", color: text, fontWeight: 700 }}>
          {ctx.style.title}
        </p>
      )}
      {ctx.style.caption && (
        <p className="line-clamp-2" style={{ fontFamily: HAND, fontSize: 17, lineHeight: "20px", color: dark ? "#d8d0e6" : "#6b6275" }}>
          {ctx.style.caption}
        </p>
      )}
      {(ctx.style.emojis.length > 0 || mood) && (
        <div className="absolute right-0 top-6 flex max-w-[150px] flex-wrap justify-end gap-1">
          {ctx.style.emojis.map((e, i) => (
            <span key={e + i} className="journal-float" style={{ fontSize: 26, transform: `rotate(${[-10, 8, -4, 12, -8, 5][i % 6]}deg)`, animationDelay: `${i * 0.35}s`, filter: "drop-shadow(0 2px 1px rgba(0,0,0,.2))" }}>
              {e}
            </span>
          ))}
        </div>
      )}
      <div className="absolute bottom-3 left-0 right-0 flex items-center gap-2" style={{ fontFamily: TYPE, fontSize: 10, color: dark ? "#d8d0e6" : "#8a8296" }}>
        {mood && (
          <span className="rounded-full px-2 py-0.5" style={{ background: accent.soft, color: accent.ink }}>
            {mood.emoji} feeling {mood.label}
          </span>
        )}
        <span>
          {ctx.messageCount} {ctx.messageCount === 1 ? "note" : "notes"}
          {ctx.photoCount > 0 ? ` · ${ctx.photoCount} ${ctx.photoCount === 1 ? "photo" : "photos"}` : ""}
        </span>
      </div>
    </div>
  );
};

const RememberNote: React.FC<{ facts: string[]; dark: boolean }> = ({ facts, dark }) => {
  const shown = facts.slice(0, 3);
  if (!shown.length) return null;
  return (
    <div className="relative" style={{ height: rememberHeight(shown.length), paddingTop: 4 }}>
      <div
        className="relative px-3 pb-2 pt-1.5"
        style={{ background: dark ? "#4a4660" : "#fff3b0", transform: "rotate(-1.2deg)", boxShadow: "0 3px 6px rgba(40,30,20,.22)", width: "92%" }}
      >
        <Washi kind="solid" color="#f7b6c2" width={52} height={15} rot={-4} className="absolute -top-2.5 left-4" />
        <p style={{ fontFamily: TYPE, fontSize: 10, letterSpacing: ".16em", color: dark ? "#ffe9a0" : "#a07a00" }} className="uppercase">✦ remember</p>
        {shown.map((f) => (
          <p key={f} className="truncate" style={{ fontFamily: HAND, fontSize: 18, lineHeight: "24px", color: dark ? "#f4efe6" : "#4a3b00" }}>
            · {f}
          </p>
        ))}
      </div>
    </div>
  );
};

/* ───────────────────────── page ───────────────────────── */

interface PageProps {
  page: JPage;
  ctx: DayContext;
  pageNumber: number;
  totalPages: number;
  side: "left" | "right" | "single";
  onOpenImage: (url: string) => void;
}

const JournalPageView: React.FC<PageProps> = ({ page, ctx, pageNumber, totalPages, side, onOpenImage }) => {
  const accent = ACCENTS[ctx.style.accent];
  const dark = ctx.style.paper === "night";
  const bctx: BlockCtx = { style: ctx.style, dark, onOpenImage };
  const rnd = seeded(`${ctx.dayKey}:deco:${page.index}`);

  // random corner doodle + washi so no two pages look alike (but a page always looks the same)
  const Doodle = DOODLES[Math.floor(rnd() * DOODLES.length)];
  const doodleLeft = rnd() > 0.5;
  const doodleSize = 30 + Math.floor(rnd() * 14);
  const doodleRot = Math.round(rnd() * 30 - 15);
  const washiKinds = Object.keys(WASHI) as WashiKey[];
  const cornerWashi = ctx.style.washi === "solid" ? washiKinds[Math.floor(rnd() * washiKinds.length)] : ctx.style.washi;
  const radius = side === "left" ? "6px 2px 2px 6px" : side === "right" ? "2px 6px 6px 2px" : "6px";
  const isLast = pageNumber === totalPages;
  const empty = page.blocks.length === 0;

  return (
    <div
      className="relative overflow-hidden"
      style={{ width: PAGE_W, height: PAGE_H, borderRadius: radius, ...paperStyle(ctx.style.paper) }}
    >
      {/* spine shading */}
      {side !== "single" && (
        <div
          className="pointer-events-none absolute inset-y-0 z-20"
          style={{
            width: 46,
            [side === "left" ? "right" : "left"]: 0,
            background: `linear-gradient(${side === "left" ? "to left" : "to right"}, rgba(60,40,20,.2), rgba(60,40,20,.06) 45%, transparent)`,
          } as React.CSSProperties}
        />
      )}

      {/* decorations that live in the margins */}
      <Washi
        kind={cornerWashi}
        color={accent.tape}
        width={96}
        height={24}
        rot={page.isFirst ? -6 : rnd() > 0.5 ? 5 : -5}
        className="absolute z-10"
        style={{ top: 6, [doodleLeft ? "right" : "left"]: -14 } as React.CSSProperties}
      />
      <div className="absolute z-10" style={{ bottom: 8, [doodleLeft ? "left" : "right"]: 14, transform: `rotate(${doodleRot}deg)` }}>
        <Doodle size={doodleSize} color={accent.ink} />
      </div>

      <div
        className="absolute z-10 flex flex-col"
        style={{ top: PAGE_PAD_TOP, left: PAGE_PAD_X, right: PAGE_PAD_X, height: CONTENT_H + 14, overflow: "hidden" }}
      >
        {page.isFirst && (
          <>
            <DayHeader ctx={ctx} dark={dark} />
            <RememberNote facts={ctx.facts} dark={dark} />
          </>
        )}
        {empty && (
          <div className="flex flex-1 flex-col items-center justify-center text-center" style={{ fontFamily: HAND, fontSize: 22, color: dark ? "#d8d0e6" : "#8a8296" }}>
            <span style={{ fontSize: 34 }}>🕊️</span>
            <p>a quiet day —</p>
            <p>no words, just us.</p>
          </div>
        )}
        {page.blocks.map((b) => {
          switch (b.kind) {
            case "text": return <TextBlock key={b.id} block={b} c={bctx} />;
            case "photo": return <PhotoBlock key={b.id} block={b} c={bctx} />;
            case "album": return <AlbumBlock key={b.id} block={b} c={bctx} />;
            case "gif": return <GifBlock key={b.id} block={b} c={bctx} />;
            case "sticker": return <StickerBlock key={b.id} block={b} />;
            case "audio": return <AudioBlock key={b.id} block={b} c={bctx} />;
            case "video": return <VideoBlock key={b.id} block={b} />;
            case "file": return <FileBlock key={b.id} block={b} c={bctx} />;
            default: return null;
          }
        })}
      </div>

      {/* footer */}
      <div
        className="absolute inset-x-0 z-10 flex items-center justify-center gap-1.5"
        style={{ bottom: 0, height: PAGE_PAD_BOTTOM - 8, fontFamily: TYPE, fontSize: 11, color: dark ? "#d8d0e6" : "#8a8296" }}
      >
        <span>— {pageNumber} —</span>
        {isLast && <StarIcon className="h-3 w-3" style={{ color: accent.ink }} fill={accent.tape} />}
      </div>
    </div>
  );
};

export default React.memo(JournalPageView);
