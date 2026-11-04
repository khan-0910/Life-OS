import { describe, expect, it } from "vitest";
import {
  ABANDON_AFTER_PAUSE_MS,
  PAUSED_LEASE_MS,
  blockingDesired,
  blockingUntil,
  endRun,
  pauseRun,
  reconcile,
  remainingMs,
  resumeRun,
  skipPhase,
  startNextFocus,
  startRun,
} from "./focus";
import { MINUTE_MS } from "./time";

let n = 0;
const opts = { autoStartBreak: true, newId: () => `s${++n}` };
const T0 = Date.parse("2026-10-30T09:00:00Z");
const min = (m: number) => m * MINUTE_MS;

function run(blocklistId: string | null = null) {
  return startRun(
    { id: "r1", presetName: "Deep work", focusMinutes: 25, breakMinutes: 5, taskId: "t1", projectId: null, blocklistId },
    T0,
  );
}

describe("focus timer", () => {
  it("derives remaining time from timestamps, not ticks", () => {
    const r = run();
    expect(remainingMs(r, T0)).toBe(min(25));
    expect(remainingMs(r, T0 + min(10))).toBe(min(15));
  });

  it("excludes paused time from focus", () => {
    let r = pauseRun(run(), T0 + min(10));
    expect(remainingMs(r, T0 + min(40))).toBe(min(15)); // frozen while paused
    r = resumeRun(r, T0 + min(40));
    expect(remainingMs(r, T0 + min(45))).toBe(min(10));
    const { sessions } = reconcile(r, T0 + min(55), opts);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.activeMs).toBe(min(25));
    expect(sessions[0]!.pausedMs).toBe(min(30));
    // Completed at the exact moment 25 active minutes were reached.
    expect(sessions[0]!.endedAt).toBe(new Date(T0 + min(55)).toISOString());
  });

  it("recovers after the tab was suspended through focus and break", () => {
    const { run: r, sessions } = reconcile(run(), T0 + min(90), opts);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.outcome).toBe("completed");
    expect(sessions[0]!.endedAt).toBe(new Date(T0 + min(25)).toISOString());
    expect(r?.phase).toBe("ready");
    expect(r?.phaseStartedAt).toBe(T0 + min(30));
  });

  it("waits paused at the start of a break when auto-start is off", () => {
    const { run: r } = reconcile(run(), T0 + min(26), { ...opts, autoStartBreak: false });
    expect(r?.phase).toBe("break");
    expect(r?.runningSince).toBeNull();
    expect(remainingMs(r!, T0 + min(60))).toBe(min(5));
  });

  it("is idempotent once reconciled", () => {
    const first = reconcile(run(), T0 + min(26), opts);
    const second = reconcile(first.run!, T0 + min(26), opts);
    expect(second.sessions).toHaveLength(0);
    expect(second.run).toEqual(first.run);
  });

  it("records an ended-early session with true active time", () => {
    const r = pauseRun(run(), T0 + min(12));
    const { run: next, sessions } = endRun(r, T0 + min(20), "ended_early", opts);
    expect(next).toBeNull();
    expect(sessions[0]).toMatchObject({ outcome: "ended_early", activeMs: min(12), pausedMs: min(8) });
  });

  it("does not save focus shorter than a minute", () => {
    expect(endRun(run(), T0 + 30_000, "ended_early", opts).sessions).toHaveLength(0);
  });

  it("does not save anything when ending during a break", () => {
    const { run: inBreak } = reconcile(run(), T0 + min(26), opts);
    expect(endRun(inBreak!, T0 + min(27), "ended_early", opts).sessions).toHaveLength(0);
  });

  it("closes a run abandoned while paused as interrupted at the pause time", () => {
    const r = pauseRun(run(), T0 + min(5));
    const { run: next, sessions } = reconcile(r, T0 + min(5) + ABANDON_AFTER_PAUSE_MS + 1, opts);
    expect(next).toBeNull();
    expect(sessions[0]).toMatchObject({ outcome: "interrupted", activeMs: min(5) });
    expect(sessions[0]!.endedAt).toBe(new Date(T0 + min(5)).toISOString());
  });

  it("skips focus into a running break and breaks into ready", () => {
    const a = skipPhase(run(), T0 + min(3), opts);
    expect(a.sessions[0]?.outcome).toBe("ended_early");
    expect(a.run?.phase).toBe("break");
    const b = skipPhase(a.run!, T0 + min(4), opts);
    expect(b.run?.phase).toBe("ready");
    const c = startNextFocus(b.run!, T0 + min(5));
    expect(c).toMatchObject({ phase: "focus", cycle: 2, phasePlannedMs: min(25) });
  });
});

describe("integration blocking state", () => {
  it("blocks only during focus with a blocklist, unless configured to keep blocking on break", () => {
    expect(blockingDesired(run(), "pause")).toBe(false);
    const r = run("b1");
    expect(blockingDesired(r, "pause")).toBe(true);
    const { run: br } = reconcile(r, T0 + min(26), opts);
    expect(blockingDesired(br, "pause")).toBe(false);
    expect(blockingDesired(br, "keep")).toBe(true);
    expect(blockingDesired(null, "keep")).toBe(false);
  });

  it("gives integrations an end time, or a short lease while paused", () => {
    const r = run("b1");
    expect(blockingUntil(r, T0, "pause")).toBe(T0 + min(25));
    expect(blockingUntil(r, T0, "keep")).toBe(T0 + min(30));
    const p = pauseRun(r, T0 + min(1));
    expect(blockingUntil(p, T0 + min(2), "pause")).toBe(T0 + min(2) + PAUSED_LEASE_MS);
  });
});
