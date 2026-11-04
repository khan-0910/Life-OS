import { describe, expect, it } from "vitest";
import { layoutDay, moveBlock, resizeBlock } from "./blocks";
import { collapseDomains, normalizeDomain, parseDomainList } from "./domains";
import { goalProgress, projectProgress } from "./progress";
import { filterTasks, rolloverCandidates, sortTasks } from "./tasks";
import { minutesInTz, dateInTz } from "./time";
import type { Project, Task, TimeBlock } from "./types";
import { validateTaskDraft } from "./validation";

const NY = "America/New_York";

function task(over: Partial<Task>): Task {
  return {
    id: Math.random().toString(36).slice(2),
    title: "Task",
    notes: "",
    status: "todo",
    priority: "none",
    dueDate: null,
    plannedFor: null,
    estimateMinutes: null,
    projectId: null,
    goalId: null,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    completedAt: null,
    ...over,
  };
}

function block(start: string, end: string, id = "b"): TimeBlock {
  return {
    id,
    title: "Block",
    start,
    end,
    kind: "focus",
    taskId: null,
    notes: "",
    createdAt: start,
    updatedAt: start,
  };
}

describe("tasks", () => {
  const today = "2026-10-30";
  const tasks = [
    task({ id: "a", title: "Write report", plannedFor: "2026-10-29" }),
    task({ id: "b", title: "Pay rent", dueDate: "2026-10-28", priority: "high" }),
    task({ id: "c", title: "Call mom", status: "done", plannedFor: "2026-10-29", completedAt: "2026-10-29T20:00:00Z" }),
    task({ id: "d", title: "Plan trip", dueDate: "2026-11-05" }),
    task({ id: "e", title: "Someday idea" }),
  ];

  it("offers only unfinished past-planned tasks for rollover", () => {
    expect(rolloverCandidates(tasks, today).map((t) => t.id)).toEqual(["a"]);
  });

  it("filters by scope, status and search", () => {
    expect(filterTasks(tasks, { scope: "overdue" }, today).map((t) => t.id)).toEqual(["b"]);
    expect(filterTasks(tasks, { scope: "upcoming" }, today).map((t) => t.id)).toEqual(["d"]);
    expect(filterTasks(tasks, { scope: "unscheduled" }, today).map((t) => t.id)).toEqual(["e"]);
    expect(filterTasks(tasks, { status: "done" }, today).map((t) => t.id)).toEqual(["c"]);
    expect(filterTasks(tasks, { status: "all", query: "RENT" }, today).map((t) => t.id)).toEqual(["b"]);
  });

  it("sorts open by priority then due date", () => {
    expect(sortTasks(tasks).map((t) => t.id)).toEqual(["b", "d", "a", "e", "c"]);
  });

  it("validates drafts at the boundary", () => {
    const bad = validateTaskDraft({ title: "  ", dueDate: "2026-02-30", estimateMinutes: "-5" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.errors).sort()).toEqual(["dueDate", "estimateMinutes", "title"]);
    const good = validateTaskDraft({ title: "  Buy\tmilk  ", estimateMinutes: "15", priority: "bogus" });
    expect(good).toMatchObject({ ok: true, value: { title: "Buy milk", estimateMinutes: 15, priority: "none" } });
  });
});

describe("time blocks", () => {
  it("lays out overlapping blocks side by side", () => {
    const blocks = [
      block("2026-10-30T13:00:00Z", "2026-10-30T14:00:00Z", "1"),
      block("2026-10-30T13:30:00Z", "2026-10-30T14:30:00Z", "2"),
      block("2026-10-30T15:00:00Z", "2026-10-30T16:00:00Z", "3"),
    ];
    const placed = layoutDay(blocks, "2026-10-30", NY);
    expect(placed.map((p) => [p.block.id, p.startMin, p.column, p.columns])).toEqual([
      ["1", 540, 0, 2],
      ["2", 570, 1, 2],
      ["3", 660, 0, 1],
    ]);
  });

  it("moves a block to another day preserving duration and wall time across DST", () => {
    const b = block("2026-10-30T13:00:00Z", "2026-10-30T14:30:00Z"); // 09:00 EDT
    const moved = moveBlock(b, "2026-11-02", 9 * 60, NY); // 09:00 EST
    expect(moved.start).toBe("2026-11-02T14:00:00.000Z");
    expect(moved.end).toBe("2026-11-02T15:30:00.000Z");
    expect(minutesInTz(moved.start, NY)).toBe(540);
  });

  it("resizes with a minimum length", () => {
    const b = block("2026-10-30T13:00:00Z", "2026-10-30T14:00:00Z");
    expect(resizeBlock(b, 10 * 60 + 30, NY).end).toBe("2026-10-30T14:30:00.000Z");
    expect(resizeBlock(b, 8 * 60, NY).end).toBe("2026-10-30T13:15:00.000Z");
  });

  it("clips blocks that cross local midnight", () => {
    const b = block("2026-10-31T03:00:00Z", "2026-10-31T05:00:00Z"); // 23:00–01:00 EDT
    expect(dateInTz(b.start, NY)).toBe("2026-10-30");
    expect(layoutDay([b], "2026-10-30", NY)[0]).toMatchObject({ startMin: 1380, endMin: 1440 });
    expect(layoutDay([b], "2026-10-31", NY)[0]).toMatchObject({ startMin: 0, endMin: 60 });
  });
});

describe("progress", () => {
  const projects: Project[] = [
    { id: "p1", title: "Launch", notes: "", goalId: "g1", dueDate: null, status: "active", createdAt: "", updatedAt: "" },
  ];
  const tasks = [
    task({ projectId: "p1", status: "done" }),
    task({ projectId: "p1" }),
    task({ goalId: "g1", status: "done" }),
    task({ goalId: "g1", projectId: "p1" }), // counted once
    task({}),
  ];

  it("derives project progress from its tasks", () => {
    expect(projectProgress("p1", tasks)).toEqual({ done: 1, total: 3, ratio: 1 / 3 });
  });

  it("derives goal progress from direct and project tasks without double counting", () => {
    expect(goalProgress("g1", projects, tasks)).toEqual({ done: 2, total: 4, ratio: 0.5 });
  });

  it("reports no ratio when nothing is linked", () => {
    expect(projectProgress("none", tasks).ratio).toBeNull();
  });
});

describe("domains", () => {
  it("normalizes urls, wildcards, www and case", () => {
    expect(normalizeDomain("https://www.YouTube.com/watch?v=1")).toEqual({ ok: true, domain: "youtube.com" });
    expect(normalizeDomain("*.reddit.com")).toEqual({ ok: true, domain: "reddit.com" });
    expect(normalizeDomain("news.ycombinator.com:443/item")).toEqual({ ok: true, domain: "news.ycombinator.com" });
    expect(normalizeDomain("bücher.de")).toEqual({ ok: true, domain: "xn--bcher-kva.de" });
    expect(normalizeDomain("10.0.0.1")).toEqual({ ok: true, domain: "10.0.0.1" });
  });

  it("rejects things that are not blockable domains", () => {
    for (const bad of ["", "localhost", "ftp://example.com", "exa mple.com", "-bad-.com", "[::1]", "1.2.3", "0x7f.1"]) {
      expect(normalizeDomain(bad).ok, bad).toBe(false);
    }
  });

  it("parses a list, dedupes and reports errors", () => {
    const r = parseDomainList("youtube.com, www.youtube.com\nreddit.com  not_a domain");
    expect(r.domains).toEqual(["youtube.com", "reddit.com"]);
    expect(r.errors.map((e) => e.input)).toEqual(["not_a", "domain"]);
    expect(parseDomainList("a.com b.com c.com", 2).errors).toHaveLength(1);
  });

  it("collapses subdomains already covered by a parent", () => {
    expect(collapseDomains(["m.youtube.com", "youtube.com", "x.com"])).toEqual(["x.com", "youtube.com"]);
  });
});
