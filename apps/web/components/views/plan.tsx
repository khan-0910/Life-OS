"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as RPointerEvent } from "react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { ChevronLeft, ChevronRight, ListTodo, Plus, Search } from "lucide-react";
import {
  addDays,
  blockTimes,
  blocksOnDate,
  dateInTz,
  filterTasks,
  formatClock,
  layoutDay,
  minutesInTz,
  type PlacedBlock,
  moveBlock,
  parseClock,
  resizeBlock,
  snapMinutes,
  sortTasks,
  startOfWeek,
  toMs,
  zonedTimeToMs,
  type BlockKind,
  type ISODate,
  type Priority,
  type Task,
  type TaskScope,
  type TimeBlock,
} from "@lifeos/domain";
import { createBlock, deleteBlock, updateBlock } from "@/lib/actions";
import { formatDateLong, formatDateShort, formatDayNumber, formatHour, formatMinutes, formatTime, formatWeekday } from "@/lib/format";
import { isTyping, useNow, useToday } from "@/lib/hooks";
import { useData } from "@/lib/store";
import { spring, t as motionT, useCalm } from "@/lib/motion";
import { BLOCK_STYLE } from "../block-style";
import { NowRule } from "../dayline";
import { TaskEditor, TaskList, PRIORITY_LABEL } from "../tasks";
import { toast } from "../toast";
import { Button, Card, Dialog, EmptyState, Field, IconButton, Input, Kbd, PageHeader, Segmented, Select, Textarea, cx } from "../ui";

export { BLOCK_STYLE };

type View = "day" | "week" | "tasks";

/** Grid swap: slides in the direction of travel for prev/next, a soft rise for view changes. */
const gridSwap: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 28, y: dir === 0 ? 6 : 0 }),
  center: { opacity: 1, x: 0, y: 0, transition: motionT.panel },
  exit: (dir: number) => ({ opacity: 0, x: dir * -28, transition: { duration: 0.14, ease: [0.22, 1, 0.36, 1] } }),
};

export function PlanView() {
  const data = useData();
  const { today, tz } = useToday();
  const [view, setViewRaw] = useState<View>("day");
  const [anchor, setAnchorRaw] = useState<ISODate>(today);
  const [dir, setDir] = useState(0);
  const setAnchor = (next: ISODate) => {
    setDir(next > anchor ? 1 : next < anchor ? -1 : 0);
    setAnchorRaw(next);
  };
  const setView = (v: View) => {
    setDir(0);
    setViewRaw(v);
  };
  const [blockDialog, setBlockDialog] = useState<{ block: TimeBlock | null; draft?: { date: ISODate; startMin: number; endMin: number } } | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);

  const dates = useMemo(() => {
    if (view === "week") {
      const start = startOfWeek(anchor, data.settings.weekStartsOn);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    return [anchor];
  }, [view, anchor, data.settings.weekStartsOn]);

  const step = view === "week" ? 7 : 1;
  const title =
    view === "week" ? `${formatDateShort(dates[0]!)} – ${formatDateShort(dates[dates.length - 1]!)}` : view === "day" ? formatDateLong(anchor) : "All tasks";

  return (
    <div>
      <PageHeader
        title="Plan"
        subtitle={view === "tasks" ? "Every task, filterable and searchable." : `${title} · times shown in ${tz.replace(/_/g, " ")}`}
        actions={
          <>
            <Segmented<View>
              label="Planner view"
              value={view}
              onChange={setView}
              options={[
                { value: "day", label: "Day" },
                { value: "week", label: "Week" },
                { value: "tasks", label: "Tasks" },
              ]}
            />
            {view !== "tasks" ? (
              <Button variant="primary" onClick={() => setBlockDialog({ block: null, draft: { date: anchor, startMin: 9 * 60, endMin: 10 * 60 } })}>
                <Plus size={15} aria-hidden /> Block
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => {
                  setEditing(null);
                  setTaskOpen(true);
                }}
              >
                <Plus size={15} aria-hidden /> Task
              </Button>
            )}
          </>
        }
      />

      {view === "tasks" ? (
        <motion.div key="tasks" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={motionT.panel}>
          <TaskManager
            today={today}
            onEdit={(t) => {
              setEditing(t);
              setTaskOpen(true);
            }}
          />
        </motion.div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <IconButton label={view === "week" ? "Previous week" : "Previous day"} onClick={() => setAnchor(addDays(anchor, -step))}>
              <ChevronLeft size={16} />
            </IconButton>
            <Button size="sm" onClick={() => setAnchor(today)} disabled={dates.includes(today)}>
              Today
            </Button>
            <IconButton label={view === "week" ? "Next week" : "Next day"} onClick={() => setAnchor(addDays(anchor, step))}>
              <ChevronRight size={16} />
            </IconButton>
            <Input type="date" aria-label="Go to date" className="w-auto!" value={anchor} onChange={(e) => e.target.value && setAnchor(e.target.value)} />
            <p className="ml-auto hidden text-xs text-ink-3 md:block">
              Drag to create or move · drag the bottom edge to resize · focused block: <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> move, <Kbd>Shift</Kbd>+<Kbd>↑↓</Kbd> resize, <Kbd>←</Kbd>
              <Kbd>→</Kbd> change day, <Kbd>Enter</Kbd> edit
            </p>
          </div>
          <div className={cx("grid gap-5", view === "day" && "lg:grid-cols-[1fr_300px]")}>
            {/* One coherent swap per navigation; grid lines and blocks move together, never individually. */}
            <div className="relative min-w-0">
              <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                <motion.div key={`${view}:${dates[0]}`} custom={dir} variants={gridSwap} initial="enter" animate="center" exit="exit">
                  <TimeGrid
                    dates={dates}
                    today={today}
                    tz={tz}
                    blocks={data.timeBlocks}
                    onCreate={(date, startMin, endMin) => setBlockDialog({ block: null, draft: { date, startMin, endMin } })}
                    onEdit={(block) => setBlockDialog({ block })}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
            {view === "day" ? <UnscheduledPanel date={anchor} tz={tz} /> : null}
          </div>
        </>
      )}

      <BlockEditor state={blockDialog} tz={tz} onClose={() => setBlockDialog(null)} />
      <TaskEditor open={taskOpen} task={editing} onClose={() => setTaskOpen(false)} />
    </div>
  );
}

// ---------- Time grid ----------

const HOUR_PX = 52;
const PX_PER_MIN = HOUR_PX / 60;

interface Drag {
  mode: "move" | "resize" | "create";
  block: TimeBlock | null;
  pointerX: number;
  pointerY: number;
  dayIndex: number;
  startMin: number;
  endMin: number;
  moved: boolean;
}

function TimeGrid({
  dates,
  today,
  tz,
  blocks,
  onCreate,
  onEdit,
}: {
  dates: ISODate[];
  today: ISODate;
  tz: string;
  blocks: TimeBlock[];
  onCreate: (date: ISODate, startMin: number, endMin: number) => void;
  onEdit: (b: TimeBlock) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const colsRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [preview, setPreview] = useState<Drag | null>(null);
  const [announce, setAnnounce] = useState("");
  // Presentation only: which block just landed (drop or keyboard move) gets a short settle.
  const [settled, setSettled] = useState<string | null>(null);
  const settleTimer = useRef<number | undefined>(undefined);
  const calm = useCalm();
  const now = useNow(60_000);

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  const land = (id: string) => {
    window.clearTimeout(settleTimer.current);
    setSettled(id);
    settleTimer.current = window.setTimeout(() => setSettled(null), 520);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const mins = dates.includes(today) ? minutesInTz(now, tz) - 90 : 7 * 60;
    el.scrollTop = Math.max(0, mins * PX_PER_MIN);
    // Scroll only when the visible dates change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates.join()]);

  const layouts = useMemo(() => dates.map((d) => layoutDay(blocks, d, tz)), [dates, blocks, tz]);

  const pointToSlot = (x: number, y: number) => {
    const rect = colsRef.current!.getBoundingClientRect();
    const dayIndex = Math.min(dates.length - 1, Math.max(0, Math.floor(((x - rect.left) / rect.width) * dates.length)));
    const minute = (y - rect.top) / PX_PER_MIN;
    return { dayIndex, minute };
  };

  const begin = (e: RPointerEvent, mode: Drag["mode"], block: TimeBlock | null, dayIndex: number, startMin: number, endMin: number) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const drag: Drag = { mode, block, pointerX: e.clientX, pointerY: e.clientY, dayIndex, startMin, endMin, moved: false };
    dragRef.current = drag;
    setPreview(drag);

    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = ev.clientX - d.pointerX;
      const dy = ev.clientY - d.pointerY;
      const moved = d.moved || Math.hypot(dx, dy) > 4;
      const delta = snapMinutes(dy / PX_PER_MIN);
      let next: Drag = { ...d, moved };
      if (d.mode === "move") {
        const dur = endMin - startMin;
        const s = Math.min(1440 - dur, Math.max(0, startMin + delta));
        next = { ...next, dayIndex: pointToSlot(ev.clientX, ev.clientY).dayIndex, startMin: s, endMin: s + dur };
      } else if (d.mode === "resize") {
        next = { ...next, endMin: Math.min(1440, Math.max(startMin + 15, endMin + delta)) };
      } else {
        const cur = Math.min(1440, Math.max(0, snapMinutes(pointToSlot(ev.clientX, ev.clientY).minute)));
        next = { ...next, endMin: Math.max(startMin + 15, cur) };
      }
      dragRef.current = { ...next, pointerX: d.pointerX, pointerY: d.pointerY };
      // Re-render only when the snapped result changes, not on every pointer move.
      if (next.moved !== d.moved || next.dayIndex !== d.dayIndex || next.startMin !== d.startMin || next.endMin !== d.endMin) {
        setPreview(dragRef.current);
      }
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      const d = dragRef.current;
      dragRef.current = null;
      setPreview(null);
      if (!d) return;
      const date = dates[d.dayIndex]!;
      if (d.mode === "create") {
        onCreate(date, d.startMin, d.moved ? d.endMin : Math.min(1440, d.startMin + 60));
        return;
      }
      if (!d.block) return;
      if (!d.moved) {
        onEdit(d.block);
        return;
      }
      const times = d.mode === "move" ? moveBlock(d.block, date, d.startMin, tz) : resizeBlock(d.block, d.endMin, tz);
      const r = updateBlock(d.block.id, times);
      if (!r.ok) toast(r.error, { tone: "error" });
      else {
        land(d.block.id);
        setAnnounce(`${d.block.title}: ${formatDateShort(date)} ${formatMinutes(d.startMin)}–${formatMinutes(d.endMin)}`);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const onBlockKey = (e: React.KeyboardEvent, block: TimeBlock) => {
    const date = dateInTz(block.start, tz);
    const start = minutesInTz(block.start, tz);
    const durMin = Math.round((toMs(block.end) - toMs(block.start)) / 60_000);
    let times: Pick<TimeBlock, "start" | "end"> | null = null;
    let msg = "";
    if ((e.key === "ArrowUp" || e.key === "ArrowDown") && e.shiftKey) {
      const end = start + durMin + (e.key === "ArrowUp" ? -15 : 15);
      if (end < start + 15) return;
      times = resizeBlock(block, end, tz);
      msg = `now ends ${formatMinutes(end % 1440)}`;
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const s = Math.min(1440 - 15, Math.max(0, start + (e.key === "ArrowUp" ? -15 : 15)));
      times = moveBlock(block, date, s, tz);
      msg = `moved to ${formatMinutes(s)}`;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const d = addDays(date, e.key === "ArrowLeft" ? -1 : 1);
      times = moveBlock(block, d, start, tz);
      msg = `moved to ${formatDateShort(d)}`;
    } else return;
    e.preventDefault();
    const r = updateBlock(block.id, times);
    if (!r.ok) return toast(r.error, { tone: "error" });
    land(block.id);
    setAnnounce(`${block.title} ${msg}`);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-block-id="${block.id}"]`)?.focus());
  };

  const nowMin = minutesInTz(now, tz);

  return (
    <Card className="overflow-hidden p-0">
      <div aria-live="polite" className="sr-only">
        {announce}
      </div>
      <div className="flex border-b border-line pl-14">
        {dates.map((d) => (
          <div key={d} className="flex-1 border-l border-line px-2 py-2.5 text-center first:border-l-0">
            <div className={cx("text-[11px]", d === today ? "text-sage" : "text-ink-3")}>{formatWeekday(d)}</div>
            <div className={cx("mx-auto mt-0.5 grid size-7 place-items-center rounded-full text-sm font-medium tabular", d === today ? "bg-sage text-sage-ink" : "text-ink")}>{formatDayNumber(d)}</div>
          </div>
        ))}
      </div>
      <div ref={scrollRef} className="scrollbar-thin relative h-[min(68dvh,720px)] overflow-y-auto">
        <div className="relative flex" style={{ height: 24 * HOUR_PX }}>
          <div className="relative w-14 shrink-0" aria-hidden>
            {Array.from({ length: 23 }, (_, i) => (
              <div key={i} className="absolute right-2 -translate-y-1/2 text-[10px] text-ink-3 tabular" style={{ top: (i + 1) * HOUR_PX }}>
                {formatHour(i + 1)}
              </div>
            ))}
          </div>
          <div ref={colsRef} className="relative flex flex-1">
            {dates.map((date, dayIndex) => (
              <div
                key={date}
                role="group"
                aria-label={`${formatDateLong(date)} schedule`}
                className="relative flex-1 touch-none border-l border-line select-none first:border-l-0"
                style={{ backgroundImage: `repeating-linear-gradient(to bottom, rgb(29 26 22 / 0.05) 0 1px, transparent 1px ${HOUR_PX}px)` }}
                onPointerDown={(e) => {
                  const { minute } = pointToSlot(e.clientX, e.clientY);
                  const s = Math.min(1440 - 15, Math.max(0, Math.floor(minute / 15) * 15));
                  begin(e, "create", null, dayIndex, s, s + 15);
                }}
              >
                {date === today ? <NowRule top={nowMin * PX_PER_MIN} /> : null}
                {/* initial={false}: blocks on first paint don't animate; created/moved-in ones grow in, deleted ones fade. */}
                <AnimatePresence initial={false}>
                {layouts[dayIndex]!.map((p) => {
                  const dragging = preview?.block?.id === p.block.id && preview.moved;
                  const style = BLOCK_STYLE[p.block.kind];
                  const height = (p.endMin - p.startMin) * PX_PER_MIN;
                  const landing = settled === p.block.id && !calm;
                  return (
                    <motion.button
                      layout="position"
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={landing ? { opacity: 1, scale: [1.04, 1] } : { opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96, transition: motionT.micro }}
                      transition={{ layout: spring.settle, scale: { duration: 0.36, ease: [0.22, 1, 0.36, 1] }, opacity: motionT.ui }}
                      key={p.block.id}
                      type="button"
                      data-block-id={p.block.id}
                      aria-label={`${p.block.title}, ${formatTime(p.block.start, tz)} to ${formatTime(p.block.end, tz)}, ${style.label}`}
                      aria-roledescription="time block"
                      onPointerDown={(e) => begin(e, "move", p.block, dayIndex, p.startMin, p.endMin)}
                      onKeyDown={(e) => onBlockKey(e, p.block)}
                      onClick={(e) => {
                        // Pointer clicks are handled on pointerup; this handles Enter/Space.
                        if (e.detail === 0) onEdit(p.block);
                      }}
                      className={cx(
                        "group absolute z-10 origin-top overflow-hidden rounded-lg border px-2 py-1 text-left text-xs shadow-sm shadow-[#1d1a16]/15 transition-[opacity,box-shadow] duration-300",
                        style.box,
                        dragging && "opacity-30",
                        landing && "ring-2 ring-violet/50",
                      )}
                      style={{
                        top: p.startMin * PX_PER_MIN + 1,
                        height: Math.max(18, height - 2),
                        left: `calc(${(p.column / p.columns) * 100}% + 3px)`,
                        width: `calc(${100 / p.columns}% - 6px)`,
                      }}
                    >
                      {/* Drop success: a light trace sweeps across the block once. */}
                      {landing ? <motion.span aria-hidden className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-linear-90 from-transparent via-white/80 to-transparent" initial={{ x: "0%" }} animate={{ x: "400%" }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} /> : null}
                      <span className="relative block truncate font-medium">{p.block.title}</span>
                      {height > 34 ? <span className="block truncate opacity-75">{`${formatTime(p.block.start, tz)} – ${formatTime(p.block.end, tz)}`}</span> : null}
                      <span
                        aria-hidden
                        onPointerDown={(e) => begin(e, "resize", p.block, dayIndex, p.startMin, p.endMin)}
                        className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100"
                      >
                        <span className="mx-auto mt-0.5 block h-0.5 w-6 rounded bg-current/60" />
                      </span>
                    </motion.button>
                  );
                })}
                </AnimatePresence>
                {preview && preview.dayIndex === dayIndex && (preview.moved || preview.mode === "create") ? (
                  <DragGhost preview={preview} overlaps={countOverlaps(layouts[dayIndex]!, preview)} />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

/** Blocks (other than the one being dragged) that the preview would overlap. Overlaps are allowed; this only informs. */
function countOverlaps(placed: PlacedBlock[], d: Drag): number {
  return placed.filter((p) => p.block.id !== d.block?.id && p.startMin < d.endMin && p.endMin > d.startMin).length;
}

/**
 * The drag preview. It springs between 15-minute slots, which is the snap
 * feedback; it shows the exact times it will commit and turns amber when it
 * overlaps another block. Purely visual: the domain logic computes the values.
 */
function DragGhost({ preview, overlaps }: { preview: Drag; overlaps: number }) {
  const kind = preview.block ? BLOCK_STYLE[preview.block.kind] : null;
  const height = (preview.endMin - preview.startMin) * PX_PER_MIN;
  return (
    <motion.div
      aria-hidden
      initial={false}
      animate={{ y: preview.startMin * PX_PER_MIN, height }}
      transition={spring.snap}
      className={cx(
        "pointer-events-none absolute inset-x-1 top-0 z-30 overflow-hidden rounded-lg border px-2 py-1 text-[11px] shadow-xl shadow-[#1d1a16]/15",
        overlaps ? "border-amber/80" : kind ? "border-ink/40" : "border-dashed border-sage/70",
        kind ? kind.box : "bg-sage/10 text-sage",
      )}
      style={{ scale: preview.block ? 1.02 : 1 }}
    >
      {preview.block ? <span className="block truncate font-medium">{preview.block.title}</span> : null}
      <span className="block font-medium tabular">
        {formatMinutes(preview.startMin)} – {formatMinutes(preview.endMin % 1440)}
      </span>
      {overlaps ? <span className="block text-amber">Overlaps {overlaps}</span> : null}
    </motion.div>
  );
}

// ---------- Unscheduled tasks for the day ----------

/** Click handler logic: put a task in the first free slot from now (or 8–9 AM on other days). */
function scheduleInNextFreeSlot(t: Task, blocks: TimeBlock[], date: ISODate, tz: string): void {
  const now = Date.now();
  const dayBlocks = blocksOnDate(blocks, date, tz);
  const dur = t.estimateMinutes ? Math.max(15, snapMinutes(t.estimateMinutes)) : 30;
  const nowMin = dateInTz(now, tz) === date ? snapMinutes(minutesInTz(now, tz) + 7) : 9 * 60;
  let start = Math.max(nowMin, 8 * 60);
  for (const b of dayBlocks) {
    const bs = dateInTz(b.start, tz) === date ? minutesInTz(b.start, tz) : 0;
    const be = dateInTz(b.end, tz) === date ? minutesInTz(b.end, tz) : 1440;
    if (start + dur > bs && start < be) start = Math.max(start, snapMinutes(be));
  }
  if (start + dur > 1440) {
    toast("No free slot left on this day.", { tone: "error" });
    return;
  }
  const r = createBlock({ title: t.title, start: new Date(zonedTimeToMs(date, start, tz)).toISOString(), end: new Date(zonedTimeToMs(date, start + dur, tz)).toISOString(), kind: "focus", taskId: t.id, notes: "" });
  if (r.ok) toast(`Scheduled at ${formatMinutes(start)}`, { action: { label: "Undo", run: () => deleteBlock(r.id) } });
}

function UnscheduledPanel({ date, tz }: { date: ISODate; tz: string }) {
  const data = useData();
  const tasks = useMemo(() => {
    const scheduled = new Set(blocksOnDate(data.timeBlocks, date, tz).map((b) => b.taskId));
    return sortTasks(data.tasks.filter((t) => t.status !== "done" && (t.plannedFor === date || t.dueDate === date) && !scheduled.has(t.id)));
  }, [data.tasks, data.timeBlocks, date, tz]);

  const schedule = (t: Task) => scheduleInNextFreeSlot(t, data.timeBlocks, date, tz);

  return (
    <Card aria-labelledby="unsched-title" className="h-fit">
      <h2 id="unsched-title" className="mb-1 text-[13px] font-medium text-ink-2">
        Not yet scheduled
      </h2>
      <p className="mb-3 text-xs text-ink-3">Planned for or due on this day, with no time block.</p>
      {tasks.length ? (
        <ul className="flex flex-col gap-1.5">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-2">
              <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
              <Button size="sm" variant="ghost" onClick={() => schedule(t)} aria-label={`Schedule ${t.title} in the next free slot`}>
                Schedule
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<ListTodo size={18} />} title="All planned work has a slot" />
      )}
    </Card>
  );
}

// ---------- Block editor ----------

function BlockEditor({
  state,
  tz,
  onClose,
}: {
  state: { block: TimeBlock | null; draft?: { date: ISODate; startMin: number; endMin: number } } | null;
  tz: string;
  onClose: () => void;
}) {
  if (!state) return null;
  return <BlockEditorInner key={state.block?.id ?? `new-${state.draft?.date}-${state.draft?.startMin}`} state={state} tz={tz} onClose={onClose} />;
}

function BlockEditorInner({ state, tz, onClose }: { state: NonNullable<Parameters<typeof BlockEditor>[0]["state"]>; tz: string; onClose: () => void }) {
  const data = useData();
  const b = state.block;
  const [form, setForm] = useState(() => ({
    title: b?.title ?? "",
    date: b ? dateInTz(b.start, tz) : state.draft!.date,
    start: formatClock(b ? minutesInTz(b.start, tz) : state.draft!.startMin),
    end: formatClock(b ? minutesInTz(b.end, tz) : state.draft!.endMin),
    kind: (b?.kind ?? "focus") as BlockKind,
    taskId: b?.taskId ?? "",
    notes: b?.notes ?? "",
  }));
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const s = parseClock(form.start);
    let en = parseClock(form.end);
    if (s === null || en === null) return setError("Use valid start and end times.");
    if (en === 0) en = 1440; // "00:00" end means midnight at the end of the day
    const times = blockTimes(form.date, s, en, tz);
    if (!times) return setError("The end must be at least 15 minutes after the start.");
    const task = data.tasks.find((t) => t.id === form.taskId);
    const input = { title: form.title || task?.title || "", start: times.start, end: times.end, kind: form.kind, taskId: form.taskId || null, notes: form.notes };
    const r = b ? updateBlock(b.id, input) : createBlock(input);
    if (!r.ok) return setError(r.error);
    toast(b ? "Block saved" : "Block added");
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={b ? "Edit time block" : "New time block"}
      description={`Times are in ${tz.replace(/_/g, " ")}.`}
      footer={
        <>
          {b ? (
            <Button
              variant={confirmDelete ? "danger" : "ghost"}
              className="mr-auto"
              onClick={() => {
                if (!confirmDelete) return setConfirmDelete(true);
                deleteBlock(b.id);
                toast("Block deleted");
                onClose();
              }}
            >
              {confirmDelete ? "Confirm delete" : "Delete"}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="block-form">
            Save
          </Button>
        </>
      }
    >
      <form id="block-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-3">
        <Field label="Title" className="sm:col-span-3">
          {(id) => <Input id={id} autoFocus value={form.title} onChange={set("title")} maxLength={200} placeholder="What is this time for?" />}
        </Field>
        <Field label="Date">{(id) => <Input id={id} type="date" required value={form.date} onChange={set("date")} />}</Field>
        <Field label="Start">{(id) => <Input id={id} type="time" step={900} required value={form.start} onChange={set("start")} />}</Field>
        <Field label="End">{(id) => <Input id={id} type="time" step={900} required value={form.end} onChange={set("end")} />}</Field>
        <Field label="Kind">
          {(id) => (
            <Select id={id} value={form.kind} onChange={set("kind")}>
              {(Object.keys(BLOCK_STYLE) as BlockKind[]).map((k) => (
                <option key={k} value={k}>
                  {BLOCK_STYLE[k].label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Linked task" className="sm:col-span-2">
          {(id) => (
            <Select id={id} value={form.taskId} onChange={set("taskId")}>
              <option value="">None</option>
              {sortTasks(data.tasks.filter((t) => t.status !== "done" || t.id === form.taskId)).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Notes" className="sm:col-span-3">
          {(id) => <Textarea id={id} rows={2} value={form.notes} onChange={set("notes")} />}
        </Field>
        {error ? (
          <p role="alert" className="text-sm text-rose sm:col-span-3">
            {error}
          </p>
        ) : null}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

// ---------- Task manager ----------

function TaskManager({ today, onEdit }: { today: ISODate; onEdit: (t: Task) => void }) {
  const data = useData();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"open" | "done" | "all">("open");
  const [scope, setScope] = useState<TaskScope>("all");
  const [priority, setPriority] = useState<Priority | "any">("any");
  const [projectId, setProjectId] = useState<string>("any");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !isTyping(e.target) && !document.querySelector("dialog[open]")) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const tasks = useMemo(() => sortTasks(filterTasks(data.tasks, { query, status, scope, priority, projectId }, today)), [data.tasks, query, status, scope, priority, projectId, today]);

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input ref={searchRef} type="search" aria-label="Search tasks" placeholder="Search title and notes  ( / )" className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Segmented<"open" | "done" | "all">
          label="Status"
          size="sm"
          value={status}
          onChange={setStatus}
          options={[
            { value: "open", label: "Open" },
            { value: "done", label: "Done" },
            { value: "all", label: "All" },
          ]}
        />
        <Select aria-label="When" className="w-auto!" value={scope} onChange={(e) => setScope(e.target.value as TaskScope)}>
          <option value="all">Any time</option>
          <option value="today">Today</option>
          <option value="overdue">Overdue</option>
          <option value="upcoming">Upcoming</option>
          <option value="unscheduled">No date</option>
        </Select>
        <Select aria-label="Priority" className="w-auto!" value={priority} onChange={(e) => setPriority(e.target.value as Priority | "any")}>
          <option value="any">Any priority</option>
          {(["high", "medium", "low", "none"] as const).map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </Select>
        <Select aria-label="Project" className="w-auto! max-w-48" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="any">Any project</option>
          {data.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </Select>
      </div>
      <p className="mb-2 text-xs text-ink-3" aria-live="polite">
        {tasks.length} task{tasks.length === 1 ? "" : "s"}
      </p>
      <TaskList
        tasks={tasks}
        today={today}
        onEdit={onEdit}
        empty={<EmptyState title={data.tasks.length ? "No tasks match these filters" : "No tasks yet"}>{data.tasks.length ? "Try clearing the search or filters." : "Press N to capture your first task."}</EmptyState>}
      />
    </Card>
  );
}
