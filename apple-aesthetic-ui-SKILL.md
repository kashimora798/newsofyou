---
name: apple-aesthetic-ui
description: Guidance for designing and building interfaces in Apple's design language — the clean, minimal, content-first look of iOS/iPadOS/macOS, with SF-style typography, frosted-glass materials, soft depth, continuous "squircle" corners, and physics-based spring motion. Use this skill whenever the user asks for an "Apple-like," "Apple-style," "iOS-style," "macOS-style," premium, polished, minimal, or clean UI/UX, or when building any web/app interface, dashboard, landing page, or component where refined consumer-grade visual quality matters — even if Apple is never mentioned by name but the request implies that level of polish.
---

# Apple-Aesthetic UI/UX

Approach this the way a designer on Apple's Human Interface Guidelines team would: every visual decision exists to make content clearer and interaction more direct, never to call attention to itself. The Apple look is not "white background plus rounded corners." It is a coherent system — typography, color, material, shape, and motion all answering to the same three values: **clarity**, **deference**, and **depth**.

- **Clarity** — text is legible at every size, icons are precise, and there is exactly one obvious next action on screen. Negative space is a tool, not an oversight.
- **Deference** — chrome, borders, and decoration recede so content (a photo, a list, a piece of writing) is the thing people actually look at. Color and ornament are used sparingly and only to clarify, never to decorate for its own sake.
- **Depth** — distinct visual layers (a sheet over a background, a translucent bar over scrolling content) give users a sense of hierarchy and motion gives that hierarchy continuity, without resorting to heavy drop shadows or fake 3D.

If the brief leaves an axis open, resolve it toward these three values rather than toward whatever a generic UI kit would default to. The rest of this skill gives concrete, implementable tokens for typography, color, shape, motion, and components so the result reads as genuinely Apple-like rather than "rounded corners and a blue accent."

## Typography

Type carries almost all of the personality in this aesthetic — there is rarely a decorative display face. Use a system-first stack so Apple devices render true San Francisco automatically, with a metrically similar fallback elsewhere:

```css
--font-display: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Helvetica Neue", Arial, sans-serif;
--font-text: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Helvetica Neue", Arial, sans-serif;
--font-mono: ui-monospace, "SF Mono", "Menlo", monospace;
```

Use a restrained type scale rather than arbitrary sizes. This roughly mirrors Apple's HIG scale — use it as a starting point and adjust to the layout's actual hierarchy needs:

| Role | Size / Line height | Weight | Tracking |
|---|---|---|---|
| Large Title | 34px / 41px | 700 (bold) | -0.4px |
| Title 1 | 28px / 34px | 700 | -0.3px |
| Title 2 | 22px / 28px | 600 | -0.2px |
| Title 3 | 20px / 25px | 600 | -0.1px |
| Headline | 17px / 22px | 600 | 0 |
| Body | 17px / 22px | 400 | 0 |
| Callout | 16px / 21px | 400 | 0 |
| Subheadline | 15px / 20px | 400 | 0 |
| Footnote | 13px / 18px | 400 | 0 |
| Caption | 12px / 16px | 400 | 0.05px |

A few rules that make this read as intentional rather than templated: lean on **weight**, not size, to create hierarchy at small scales (a 17px semibold headline next to 17px regular body is a very Apple move). Keep negative tracking only on the largest sizes — body text should never be tightened. Body copy is almost always left-aligned, never justified, and line length should stay readable (roughly 50–75 characters per line on text-heavy layouts).

## Color and materials

Apple interfaces use a small neutral palette plus exactly one (sometimes two) accent colors used sparingly and consistently for actionable elements only — never for decoration. Define both light and dark values as CSS variables from the start; this aesthetic depends on dark mode parity, not a bolted-on dark theme.

```css
:root {
  /* Labels */
  --label: rgba(0,0,0,0.92);
  --label-secondary: rgba(0,0,0,0.58);
  --label-tertiary: rgba(0,0,0,0.30);

  /* Backgrounds */
  --bg-primary: #ffffff;
  --bg-secondary: #f2f2f7;
  --bg-tertiary: #ffffff;
  --separator: rgba(0,0,0,0.08);

  /* One accent, used for actions only */
  --accent: #007aff;

  /* System semantics — borrow sparingly, only for true semantic meaning */
  --success: #34c759;
  --warning: #ff9500;
  --danger: #ff3b30;
}

[data-theme="dark"] {
  --label: rgba(255,255,255,0.92);
  --label-secondary: rgba(255,255,255,0.55);
  --label-tertiary: rgba(255,255,255,0.28);

  --bg-primary: #000000;
  --bg-secondary: #1c1c1e;
  --bg-tertiary: #2c2c2e;
  --separator: rgba(255,255,255,0.12);

  --accent: #0a84ff;
  --success: #30d158;
  --warning: #ff9f0a;
  --danger: #ff453a;
}
```

The most important discipline here: **resist adding a second accent color**. A page with a blue button, a purple badge, and a green tag does not look Apple-like — it looks like a generic SaaS template. Pick one accent and let weight, size, and spacing — not extra hues — carry the rest of the hierarchy.

### Materials (the frosted-glass look)

Translucent "material" surfaces — navigation bars, sheets, sidebars — are one of the most recognizable Apple signatures. The effect is blur plus saturation boost plus a hairline border, not a flat semi-transparent color:

```css
.material-regular {
  background-color: rgba(255,255,255,0.72);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 0.5px solid var(--separator);
}
[data-theme="dark"] .material-regular {
  background-color: rgba(28,28,30,0.72);
}
```

Use this for elements that float above scrolling content (top bars, tab bars, sheets, popovers) — never for static page backgrounds, where it adds cost with no payoff.

## Spacing and layout

Apple layouts read as calm because they're built on a consistent grid with generous, not cramped, whitespace. Use multiples of 4 (8 for most gaps) rather than arbitrary pixel values:

```css
--space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
--space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px;
```

Standard content margins are 16–20px on mobile widths and 24px+ at wider breakpoints. Group related controls tightly (4–8px) and separate unrelated sections generously (32px+) — the *ratio* between tight and loose spacing is what creates visible hierarchy without needing borders or boxes to do the work.

## Shape language

Apple's defining shape signature is the **continuous corner** ("squircle") — a corner that blends smoothly into the edge rather than a true circular-radius rounded rect. CSS can't do a true continuous corner, but a slightly larger radius than feels "default" gets close, especially combined with the rule that an inner element's radius should be visually concentric with its parent's (inner radius ≈ outer radius − padding):

```css
--radius-sm: 8px;    /* small controls, chips, inputs */
--radius-md: 14px;   /* buttons, list rows */
--radius-lg: 20px;   /* cards, panels */
--radius-xl: 28px;   /* sheets, modals */
--radius-full: 999px; /* pills and capsule buttons only */
```

Avoid two failure modes: sharp 0–2px corners (reads as generic enterprise software) and applying `border-radius: 999px` to everything (reads as a different, "bubbly" aesthetic, not Apple's). Reserve the full pill shape for segmented controls and small capsule buttons.

## Depth and elevation

Depth comes from layering and blur, not heavy drop shadows. Keep shadows soft, diffuse, and low-opacity — they should suggest a sheet of paper, not a UI kit's default `box-shadow: 0 4px 6px rgba(0,0,0,0.3)`:

```css
--shadow-sm: 0 1px 2px rgba(0,0,0,0.06);
--shadow-md: 0 4px 12px rgba(0,0,0,0.08);
--shadow-lg: 0 12px 32px rgba(0,0,0,0.12);
```

Elevation should also be rare and meaningful: a card resting on a background gets `--shadow-sm`; a sheet or popover presented over content gets `--shadow-lg` plus a dimmed/blurred backdrop behind it. Avoid stacking shadows on every card on a page — if everything is elevated, nothing is.

## Motion

Apple motion is springy and responsive to touch/click, not linear and decorative. Two timing tokens cover almost every case:

```css
--ease-spring: cubic-bezier(0.32, 0.72, 0, 1); /* settles fast, slight overshoot-free ease-out */
--duration-fast: 0.18s;   /* hover, small state changes */
--duration-medium: 0.32s; /* sheet/modal presentation, expanding cards */
```

A few concrete patterns worth implementing directly:

```css
/* Press feedback — used on nearly every tappable element */
.tappable {
  transition: transform var(--duration-fast) var(--ease-spring),
              opacity var(--duration-fast) var(--ease-spring);
}
.tappable:active {
  transform: scale(0.96);
  opacity: 0.85;
}

/* Sheet presentation */
.sheet {
  transition: transform var(--duration-medium) var(--ease-spring);
  transform: translateY(100%);
}
.sheet.open { transform: translateY(0); }
```

Motion should always be a *response* to something the user did (a tap, a scroll, an open/close) — never an ambient animation looping in the background. Always respect `prefers-reduced-motion` by falling back to an opacity-only transition.

## Iconography

Icons should read as one consistent family: thin, even stroke weight (matching the optical weight of the nearby text — a regular-weight headline pairs with a regular-weight icon, not a bold one), monochrome by default, single-color tinted with `--accent` only when an icon is itself the interactive/selected element. Never mix filled and outline icon styles in the same view, and never mix icon libraries with visibly different stroke widths or corner treatments — that mismatch is one of the fastest ways a UI stops looking Apple-like.

## Component patterns

**Buttons** — Apple defines several tiers; replicate the visual logic even outside native frameworks:
- *Filled* (primary action): solid `--accent` background, white label, `--radius-md`, used once per screen for the one obvious next action.
- *Tinted/bordered* (secondary): `--accent` at low opacity background or a hairline border, `--accent`-colored label.
- *Plain* (tertiary): no background, `--accent`-colored text only — used for low-emphasis actions like "Cancel."

```css
.btn-filled {
  background: var(--accent); color: #fff;
  border-radius: var(--radius-md);
  padding: 10px 18px; font-weight: 600; font-size: 17px;
}
.btn-tinted {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--accent);
  border-radius: var(--radius-md);
  padding: 10px 18px; font-weight: 600;
}
```

**Segmented controls** — a single pill-shaped container (`--radius-full` or `--radius-md` depending on size) with a sliding selected-state background, not separate buttons with gaps between them.

**Cards / grouped lists** — flat `--bg-tertiary` surface, `--radius-lg`, `--shadow-sm`, internal dividers as 0.5px hairlines (`--separator`) rather than full borders between rows.

**Sheets / modals** — present from the bottom (mobile) or center (desktop) with the spring transition above, a dimmed+blurred backdrop, `--radius-xl` on the top corners only, and a small centered "grabber" bar (a 36×5px rounded rect at 30% opacity) on bottom sheets to signal draggability.

**Navigation / tab bars** — `.material-regular` surface fixed to an edge, icon-above-label tab items, the active tab distinguished by `--accent` tint rather than a background fill or underline.

## Interaction states

Every interactive element needs a deliberate hover (desktop), press, and focus state — Apple interfaces never leave a button visually identical between idle and active:

- **Hover**: subtle background tint or 2–4% opacity shift, `--duration-fast`. Never a translateY/lift on hover — that's a different (card-based SaaS) aesthetic.
- **Press**: `scale(0.96)` plus a slight opacity drop, as shown above.
- **Focus**: a visible 2px `--accent` ring with ~2px offset — required for accessibility and consistent with how visionOS/macOS render keyboard/remote focus.

## Accessibility

This aesthetic is not just decorative restraint — Apple's HIG ties directly to accessibility, and skipping these undercuts the whole look:

- Maintain at least 4.5:1 contrast for body text against its background in both light and dark themes; verify the specific hex values above, don't assume.
- Respect `prefers-reduced-motion: reduce` by disabling spring/transform transitions and keeping only opacity fades.
- Respect `prefers-color-scheme` for default theme, and let the user override it explicitly.
- Use `rem`/relative units for type so it scales with the user's OS/browser text-size settings (the web analog of Dynamic Type).
- Hit targets should be at least 44×44px, even when the visible glyph is smaller — pad clickable area rather than enlarging the icon.

## Anti-patterns to avoid

These are the tells that an interface is aiming for "clean and modern" generically rather than genuinely Apple-like — actively avoid all of them:

- Heavy, dark, multi-layered drop shadows on every card.
- More than one accent color doing the same job (a blue button next to a purple badge next to a green tag).
- Hard 0–2px corners, or `border-radius: 999px` applied indiscriminately to non-pill elements.
- Gradients used as decoration rather than to simulate a material (glow effects, rainbow borders, neon accents).
- Mixed icon styles (some filled, some outline, some two-tone) in the same view.
- Centered/justified body paragraphs, or all-caps body text.
- Ambient looping background animation unrelated to user input.
- Translucent "glass" backgrounds with no blur — a low-opacity flat color alone does not read as a material.

## Process

Treat this like any other design pass: rough out the layout and content hierarchy first in plain structure (what's the one primary action, what's the content people actually came for), then apply typography and color tokens, then shape and depth, then motion last — motion should clarify a hierarchy that already works without it, not compensate for one that doesn't. Before finishing, do a quick self-critique pass: would this still look distinctly Apple-like with all color removed, just from type weight, spacing, and shape? If yes, the system is working; if the page leans on color or shadow to do the work that hierarchy should be doing, simplify.
