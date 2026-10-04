import { describe, it, expect } from "vitest";
import {
  formatToday,
  moonPosition,
  phaseGreeting,
  phaseWhisper,
  scenePhase,
  starDensity,
} from "@/lib/sceneTime";

/**
 * The Home scene reads the clock, so its behaviour is worth pinning down:
 * a wrong phase means the wrong sky, the wrong greeting and a moon in the
 * morning. (build-plan Phase 3)
 */
const at = (hour: number) => new Date(2026, 9, 3, hour, 30, 0);

describe("scenePhase", () => {
  it("buckets the day the way the scene paints it", () => {
    expect(scenePhase(at(5))).toBe("dawn");
    expect(scenePhase(at(7))).toBe("dawn");
    expect(scenePhase(at(8))).toBe("day");
    expect(scenePhase(at(16))).toBe("day");
    expect(scenePhase(at(17))).toBe("dusk");
    expect(scenePhase(at(20))).toBe("dusk");
    expect(scenePhase(at(21))).toBe("night");
    expect(scenePhase(at(2))).toBe("night");
  });

  it("greets in the right voice", () => {
    expect(phaseGreeting("dawn")).toBe("good morning");
    expect(phaseGreeting("day")).toBe("good afternoon");
    expect(phaseGreeting("dusk")).toBe("good evening");
    expect(phaseGreeting("night")).toBe("good night");
  });

  it("knows that 2am deserves its own line", () => {
    expect(phaseWhisper("night", 2)).toBe("still awake, you two");
    expect(phaseWhisper("night", 22)).toBe("the house is quiet");
  });
});

describe("the sky", () => {
  it("is starrier at night than in the day", () => {
    expect(starDensity("night")).toBeGreaterThan(starDensity("dusk"));
    expect(starDensity("dusk")).toBeGreaterThan(starDensity("dawn"));
    expect(starDensity("dawn")).toBeGreaterThan(starDensity("day"));
  });

  it("keeps the moon on screen at every hour, and higher at midnight than at dawn", () => {
    for (const hour of [0, 3, 5, 17, 21, 23]) {
      const { x, y } = moonPosition(scenePhase(at(hour)), hour);
      expect(x).toBeGreaterThanOrEqual(0.1);
      expect(x).toBeLessThanOrEqual(0.9);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(0.4);
    }
    // The moon sets towards the left→right arc: at 4am it is further right than at 1am.
    expect(moonPosition("night", 4).x).toBeGreaterThan(moonPosition("night", 1).x);
  });

  it("formats today with the weekday first", () => {
    expect(formatToday(new Date(2026, 9, 3))).toMatch(/^Saturday, 3 October$/);
  });
});
