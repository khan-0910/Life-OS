import { beforeEach, describe, expect, it } from "vitest";

let reduced = false;
const targets = new Set<string>();
Object.assign(globalThis, {
  window: { matchMedia: (q: string) => ({ matches: q.includes("reduced-motion") && reduced }) },
  document: { querySelector: (s: string) => (targets.has(s) ? {} : null) },
});

const { fxEnter, fxThreshold, fxTrail, onFx } = await import("./fx");

const el = { getBoundingClientRect: () => ({ left: 10, top: 20, width: 20, height: 20 }) } as unknown as Element;

beforeEach(() => {
  reduced = false;
  targets.clear();
});

describe("fx bus (presentation only)", () => {
  it("delivers effects to the layer with unique ids", () => {
    const got: { kind: string; id: number }[] = [];
    const off = onFx((e) => got.push(e));
    fxEnter(100, 200);
    fxThreshold(["#fff", "#000"]);
    off();
    expect(got.map((e) => e.kind)).toEqual(["enter", "threshold"]);
    expect(got[0]!.id).not.toBe(got[1]!.id);
  });

  it("emits nothing under reduced motion", () => {
    reduced = true;
    targets.add('[data-fx-target="tasks"]');
    const got: unknown[] = [];
    const off = onFx((e) => got.push(e));
    fxEnter(1, 1);
    fxThreshold(["#fff", "#000"]);
    fxTrail(el, '[data-fx-target="tasks"]', ["#fff"]);
    off();
    expect(got).toEqual([]);
  });

  it("skips a trail when its source or target is missing (e.g. completing from the Plan list)", () => {
    const got: unknown[] = [];
    const off = onFx((e) => got.push(e));
    fxTrail(el, '[data-fx-target="tasks"]', ["#fff"]);
    fxTrail(null, '[data-fx-target="tasks"]', ["#fff"]);
    targets.add('[data-fx-target="tasks"]');
    fxTrail(el, '[data-fx-target="tasks"]', ["#fff"]);
    off();
    expect(got).toHaveLength(1);
  });

  it("stops delivering after unsubscribe", () => {
    const got: unknown[] = [];
    const off = onFx((e) => got.push(e));
    off();
    fxEnter(1, 1);
    expect(got).toEqual([]);
  });
});
