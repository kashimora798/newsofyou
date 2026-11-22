import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { computeStreak, localDateStr } from "@/hooks/useStreakState";

const day = (offset: number, from = "2026-11-01") => {
  const [y, m, d] = from.split("-").map(Number);
  return localDateStr(new Date(y, m - 1, d + offset));
};

describe("computeStreak", () => {
  const today = "2026-11-01";

  it("is NOT capped at 56 days (regression: PostgREST 1000-row limit)", () => {
    // 200 consecutive days of chatting, ending yesterday
    const days = new Set(Array.from({ length: 200 }, (_, i) => day(-(i + 1), today)));
    const r = computeStreak(days, today, true);
    expect(r.current).toBe(201); // 200 days + today
    expect(r.longest).toBe(201);
  });

  it("keeps the streak alive while today is still empty", () => {
    const days = new Set([day(-1, today), day(-2, today), day(-3, today)]);
    const r = computeStreak(days, today, false);
    expect(r.current).toBe(3);
  });

  it("resets when a day is missed", () => {
    const days = new Set([day(-2, today), day(-3, today)]);
    const r = computeStreak(days, today, true);
    expect(r.current).toBe(1); // only today
    expect(r.longest).toBe(2);
  });

  it("finds the longest historic run", () => {
    const days = new Set([day(-20, today), day(-19, today), day(-18, today), day(-17, today), day(-1, today)]);
    const r = computeStreak(days, today, false);
    expect(r.current).toBe(1);
    expect(r.longest).toBe(4);
  });

  it("handles no messages", () => {
    const r = computeStreak(new Set(), today, false);
    expect(r.current).toBe(0);
    expect(r.longest).toBe(0);
  });

  it("works across month and year boundaries", () => {
    const t = "2027-01-02";
    const days = new Set(["2027-01-01", "2026-12-31", "2026-12-30"]);
    expect(computeStreak(days, t, true).current).toBe(4);
  });
});
