/**
 * treeGrowth.ts — how big "our tree" is, and why.
 *
 * This used to live inside a three.js scene file, which meant the rules about
 * your own tree could not be read without a WebGL renderer. They are plain data:
 * a message count goes in, a stage comes out. The drawing (whatever draws it)
 * only ever consumes this.
 */

export interface GrowthStage {
  /** Stable id — safe to use as a React key. */
  key: string;
  label: string;
  description: string;
  /** Messages needed to reach this stage. */
  minMessages: number;
  /** How large the canopy should be drawn, 0…1. */
  scale: number;
  /** How many blossom clusters sit in the canopy. */
  blossomCount: number;
  /** How many times the branches fork. */
  branchLevels: number;
  /** Blossom colour (CSS). */
  tint: string;
  /** Trunk / branch colour (CSS). */
  branchTint: string;
}

/** The ladder, in order. Each stage states the count that unlocks it. */
export const GROWTH_STAGES: GrowthStage[] = [
  {
    key: "sapling",
    label: "Sapling",
    description: "Just a tiny seedling — your story is just beginning.",
    minMessages: 0,
    scale: 0.3,
    blossomCount: 10,
    branchLevels: 2,
    tint: "#ff9db1",
    branchTint: "#6b4b3a",
  },
  {
    key: "young",
    label: "Young Tree",
    description: "A young tree reaching for the sky.",
    minMessages: 50,
    scale: 0.52,
    blossomCount: 22,
    branchLevels: 3,
    tint: "#ff8fa8",
    branchTint: "#6a4a3c",
  },
  {
    key: "flourishing",
    label: "Flourishing",
    description: "Roots deep, branches wide — a love growing strong.",
    minMessages: 200,
    scale: 0.74,
    blossomCount: 40,
    branchLevels: 4,
    tint: "#ff7a99",
    branchTint: "#5f4337",
  },
  {
    key: "majestic",
    label: "Majestic",
    description: "A majestic tree that has weathered every season.",
    minMessages: 500,
    scale: 0.9,
    blossomCount: 64,
    branchLevels: 5,
    tint: "#ff6a8c",
    branchTint: "#553c33",
  },
  {
    key: "eternal",
    label: "Ancient & Eternal",
    description: "An ancient tree — your bond is legend.",
    minMessages: 1000,
    scale: 1,
    blossomCount: 96,
    branchLevels: 6,
    tint: "#ff5c85",
    branchTint: "#4b352e",
  },
];

/** Which stage a message count has reached. Never throws, never returns null. */
export function getGrowthStage(totalMessages: number): GrowthStage {
  const count = Number.isFinite(totalMessages) ? Math.max(0, totalMessages) : 0;
  let current = GROWTH_STAGES[0];
  for (const stage of GROWTH_STAGES) {
    if (count >= stage.minMessages) current = stage;
  }
  return current;
}

/** The stage after this one, or null once the tree is Ancient & Eternal. */
export function nextStage(stage: GrowthStage): GrowthStage | null {
  const index = GROWTH_STAGES.findIndex((s) => s.key === stage.key);
  if (index < 0 || index === GROWTH_STAGES.length - 1) return null;
  return GROWTH_STAGES[index + 1];
}

/**
 * How far along the climb to the next stage we are, 0…1.
 * Returns 1 when there is nothing left to climb.
 */
export function stageProgress(totalMessages: number): number {
  const count = Number.isFinite(totalMessages) ? Math.max(0, totalMessages) : 0;
  const stage = getGrowthStage(count);
  const next = nextStage(stage);
  if (!next) return 1;
  const span = next.minMessages - stage.minMessages;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (count - stage.minMessages) / span));
}

/** "162 messages to Flourishing" — the nudge under the tree. */
export function stageHint(totalMessages: number): string | null {
  const count = Number.isFinite(totalMessages) ? Math.max(0, totalMessages) : 0;
  const next = nextStage(getGrowthStage(count));
  if (!next) return null;
  const left = Math.max(1, next.minMessages - count);
  return `${left.toLocaleString()} more message${left === 1 ? "" : "s"} to ${next.label}`;
}
