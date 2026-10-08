import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { GROWTH_STAGES, getGrowthStage, nextStage, stageHint, stageProgress } from "@/lib/treeGrowth";
import { themeFamilies } from "@/lib/themeFonts";
import { CHAT_THEMES } from "@/lib/chatThemes";

const ROOT = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

describe("our tree grows by the numbers", () => {
  it("steps up exactly at each threshold", () => {
    expect(getGrowthStage(0).key).toBe("sapling");
    expect(getGrowthStage(49).key).toBe("sapling");
    expect(getGrowthStage(50).key).toBe("young");
    expect(getGrowthStage(199).key).toBe("young");
    expect(getGrowthStage(200).key).toBe("flourishing");
    expect(getGrowthStage(500).key).toBe("majestic");
    expect(getGrowthStage(1000).key).toBe("eternal");
    expect(getGrowthStage(999999).key).toBe("eternal");
  });

  it("is unshakeable about nonsense counts", () => {
    expect(getGrowthStage(-5).key).toBe("sapling");
    expect(getGrowthStage(NaN).key).toBe("sapling");
  });

  it("knows what comes next, and stops at the top", () => {
    expect(nextStage(getGrowthStage(10))?.key).toBe("young");
    expect(nextStage(getGrowthStage(1000))).toBeNull();
    expect(stageProgress(1000)).toBe(1);
  });

  it("measures the climb to the next stage", () => {
    expect(stageProgress(0)).toBe(0);
    expect(stageProgress(25)).toBeCloseTo(0.5, 5); // half of 0 → 50
    expect(stageHint(0)).toBe("50 more messages to Young Tree");
    expect(stageHint(1)).toBe("49 more messages to Young Tree");
    expect(stageHint(1010)).toBeNull();
  });

  it("keeps the stages in order", () => {
    const thresholds = GROWTH_STAGES.map((s) => s.minMessages);
    expect(thresholds).toEqual([...thresholds].sort((a, b) => a - b));
    expect(GROWTH_STAGES[0].minMessages).toBe(0);
  });
});

describe("theme fonts are fetched on demand, never all at once", () => {
  it("has a font ready for every theme that has one", () => {
    expect(themeFamilies("theme-spy")).toContain("Special Elite");
    expect(themeFamilies("theme-geocities")).toContain("Comic Neue");
    expect(themeFamilies("theme-gameboy")).toContain("Silkscreen");
    expect(themeFamilies("theme-horror")).toContain("Creepster");
    expect(themeFamilies("theme-romance")).toContain("Lora");
  });

  it("leaves the base look, and an unthemed chat, alone", () => {
    expect(themeFamilies("")).toBeNull();
    expect(themeFamilies("theme-galaxy")).toBeNull(); // galaxy reuses the base faces
  });

  it("index.css declares the theme faces but does not fetch them", () => {
    const css = readFileSync(join(ROOT, "src/index.css"), "utf8");
    // The theme selectors must still name their family — that is what a theme is.
    expect(css).toContain("'Special Elite'");
    // What they must not do is pull it down on every visit.
    const imports = css.match(/@import[^;]+;/g) ?? [];
    expect(imports).toHaveLength(2);
    for (const font of ["Special+Elite", "Comic+Neue", "Silkscreen", "Creepster", "Share+Tech+Mono", "Playfair+Display", "Lora:"]) {
      expect(imports.join(" ")).not.toContain(font);
    }
    expect(imports.join(" ")).toContain("Nunito");
    expect(imports.join(" ")).toContain("Caveat");
  });

  it("every chat theme is either fontless or mapped", () => {
    for (const theme of CHAT_THEMES) {
      if (!theme.cssClass) continue;
      const hasFont = themeFamilies(theme.cssClass) !== null;
      const needsFont = ["theme-spy", "theme-geocities", "theme-gameboy", "theme-horror", "theme-romance"].includes(
        theme.cssClass,
      );
      expect(hasFont).toBe(needsFont);
    }
  });
});

describe("the 3D stack stays out", () => {
  // Everything except the tests themselves — this file names the packages it bans.
  const sources = walk(join(ROOT, "src")).filter(
    (f) => [".ts", ".tsx"].includes(extname(f)) && !f.includes(`${join("src", "test")}`),
  );

  it("no source file imports three, react-three or ez-tree", () => {
    const offenders = sources.filter((file) => {
      const text = readFileSync(file, "utf8");
      return /from "three"/.test(text) || /@react-three/.test(text) || /ez-tree/.test(text);
    });
    expect(offenders).toEqual([]);
  });

  it("the heavy model and texture folders are gone", () => {
    for (const gone of ["public/textures", "public/models", "public/forest", "src/components/forest"]) {
      expect(existsSync(join(ROOT, gone))).toBe(false);
    }
  });

  it("neither three nor its helpers is in package.json", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const name of ["three", "@react-three/fiber", "@react-three/drei", "@dgreenheck/ez-tree"]) {
      expect(all[name]).toBeUndefined();
    }
  });

  it("the vite config does not force vendor chunks into the first request", () => {
    const config = readFileSync(join(ROOT, "vite.config.ts"), "utf8");
    expect(config).not.toContain("manualChunks");
  });
});

describe("the page shell stays closed and light", () => {
  it("tells crawlers to stay out", () => {
    const robots = readFileSync(join(ROOT, "public/robots.txt"), "utf8");
    expect(robots).toContain("User-agent: *");
    expect(robots).toContain("Disallow: /");
    expect(robots).not.toMatch(/^Allow: \/$/m);
  });

  it("carries noindex and no third-party tracking image", () => {
    const html = readFileSync(join(ROOT, "index.html"), "utf8");
    expect(html).toContain('name="robots"');
    expect(html).toContain("noindex");
    expect(html).not.toContain("storage.googleapis.com");
    expect(html).not.toContain("gpt-engineer");
  });

  it("ships security headers", () => {
    const vercel = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8"));
    const keys = vercel.headers.flatMap((h: { headers: { key: string }[] }) => h.headers.map((x) => x.key));
    for (const header of [
      "Content-Security-Policy",
      "X-Frame-Options",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Strict-Transport-Security",
      "Permissions-Policy",
    ]) {
      expect(keys).toContain(header);
    }
    const csp = vercel.headers
      .flatMap((h: { headers: { key: string; value: string }[] }) => h.headers)
      .find((h: { key: string }) => h.key === "Content-Security-Policy")?.value as string;
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
  });
});
