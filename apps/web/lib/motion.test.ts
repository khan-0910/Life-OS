import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let reduced = false;
Object.assign(globalThis, {
  window: {
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    matchMedia: (q: string) => ({ matches: q.includes("reduced-motion") && reduced }),
  },
});

const { COMPLETE_HOLD_MS, getHeldCompletions, holdCompleted, releaseHold } = await import("./motion");

beforeEach(() => {
  vi.useFakeTimers();
  reduced = false;
});
afterEach(() => {
  vi.runAllTimers();
  vi.useRealTimers();
});

describe("completion hold (presentation only)", () => {
  it("keeps a just-completed task in place for the hold, then releases it", () => {
    holdCompleted("t1");
    expect(getHeldCompletions().has("t1")).toBe(true);
    vi.advanceTimersByTime(COMPLETE_HOLD_MS - 1);
    expect(getHeldCompletions().has("t1")).toBe(true);
    vi.advanceTimersByTime(1);
    expect(getHeldCompletions().has("t1")).toBe(false);
  });

  it("releases immediately on undo", () => {
    holdCompleted("t2");
    releaseHold("t2");
    expect(getHeldCompletions().has("t2")).toBe(false);
  });

  it("never holds when the user prefers reduced motion", () => {
    reduced = true;
    holdCompleted("t3");
    expect(getHeldCompletions().has("t3")).toBe(false);
  });

  it("tracks several completions independently", () => {
    holdCompleted("a");
    vi.advanceTimersByTime(300);
    holdCompleted("b");
    vi.advanceTimersByTime(COMPLETE_HOLD_MS - 300);
    expect([...getHeldCompletions()]).toEqual(["b"]);
  });
});
