"use client";

import { useMemo, useState } from "react";
import { History } from "lucide-react";
import { addDays, summarizeDay, type ISODate, type Task } from "@lifeos/domain";
import { planTasksFor, saveReview, updateSettings } from "@/lib/actions";
import { formatDateLong, relativeDay } from "@/lib/format";
import { useData } from "@/lib/store";
import { toast } from "./toast";
import { Button, Dialog, Field, Segmented, Textarea } from "./ui";

/** Unfinished tasks from earlier days. Nothing moves until the user chooses. */
export function RolloverPanel({ tasks, today }: { tasks: Task[]; today: ISODate }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(tasks.map((t) => t.id)));
  const ids = tasks.filter((t) => selected.has(t.id)).map((t) => t.id);
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const apply = (date: ISODate | null, label: string) => {
    planTasksFor(ids, date);
    toast(`${ids.length} task${ids.length === 1 ? "" : "s"} ${label}`, { action: { label: "Undo", run: () => tasks.forEach((t) => planTasksFor([t.id], t.plannedFor)) } });
  };
  return (
    <section aria-labelledby="rollover-title" className="rounded-3xl border-2 border-ink bg-butter p-4 shadow-[5px_5px_0_0_#1d1a16] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="rollover-title" className="flex items-center gap-2 text-sm font-medium text-amber">
            <History size={15} aria-hidden /> {tasks.length} unfinished from earlier days
          </h2>
          <p className="mt-0.5 text-xs text-ink-3">LifeOS never moves work on its own. Choose what to bring forward.</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => updateSettings({ rolloverDismissedOn: today })}>
          Leave for now
        </Button>
      </div>
      <ul className="mt-3 flex flex-col gap-1">
        {tasks.map((t) => (
          <li key={t.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-ink/[0.03]">
              <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} className="size-4 accent-[var(--color-amber)]" />
              <span className="min-w-0 flex-1 truncate">{t.title}</span>
              <span className="text-xs text-ink-3">planned {relativeDay(t.plannedFor!, today)}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="primary" disabled={!ids.length} onClick={() => apply(today, "moved to today")}>
          Move {ids.length || ""} to today
        </Button>
        <Button size="sm" disabled={!ids.length} onClick={() => apply(addDays(today, 1), "moved to tomorrow")}>
          Tomorrow
        </Button>
        <Button size="sm" variant="ghost" disabled={!ids.length} onClick={() => apply(null, "moved to backlog")}>
          Unschedule
        </Button>
      </div>
    </section>
  );
}

type Choice = "keep" | "tomorrow" | "backlog";

export function DailyReviewDialog({ open, onClose, date, tz }: { open: boolean; onClose: () => void; date: ISODate; tz: string }) {
  return open ? <ReviewInner onClose={onClose} date={date} tz={tz} /> : null;
}

function ReviewInner({ onClose, date, tz }: { onClose: () => void; date: ISODate; tz: string }) {
  const data = useData();
  const summary = useMemo(() => summarizeDay(data.tasks, date, tz), [data.tasks, date, tz]);
  const existing = data.reviews.find((r) => r.date === date);
  const [note, setNote] = useState(existing?.note ?? "");
  const [choices, setChoices] = useState<Record<string, Choice>>({});

  const save = () => {
    const tomorrow = summary.unfinished.filter((t) => choices[t.id] === "tomorrow").map((t) => t.id);
    const backlog = summary.unfinished.filter((t) => choices[t.id] === "backlog").map((t) => t.id);
    if (tomorrow.length) planTasksFor(tomorrow, addDays(date, 1));
    if (backlog.length) planTasksFor(backlog, null);
    saveReview({
      date,
      note,
      plannedTaskIds: summary.planned.map((t) => t.id),
      completedTaskIds: summary.completed.map((t) => t.id),
      movedTaskIds: [...tomorrow, ...backlog],
    });
    toast("Review saved");
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      wide
      title="Daily review"
      description={formatDateLong(date)}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            Save review
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Planned", summary.planned.length, "Planned for or due today"],
          ["Completed", summary.completed.length, "Finished today, planned or not"],
          ["Still open", summary.unfinished.length, "Planned but not done"],
        ].map(([label, value, hint]) => (
          <div key={label as string} className="rounded-xl border border-line bg-raised/50 px-3 py-2.5">
            <div className="text-xs text-ink-3">{label}</div>
            <div className="mt-0.5 text-xl font-semibold tabular">{value}</div>
            <div className="text-[11px] text-ink-3">{hint}</div>
          </div>
        ))}
      </div>
      {summary.completed.length ? (
        <div className="mt-5">
          <h3 className="mb-1.5 text-[13px] font-medium text-ink-2">Done</h3>
          <ul className="flex flex-col gap-1 text-sm text-ink-2">
            {summary.completed.map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                <span aria-hidden className="size-1.5 rounded-full bg-sage" /> {t.title}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {summary.unfinished.length ? (
        <div className="mt-5">
          <h3 className="mb-1.5 text-[13px] font-medium text-ink-2">What should move?</h3>
          <ul className="flex flex-col gap-2">
            {summary.unfinished.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                <Segmented<Choice>
                  size="sm"
                  label={`Plan for ${t.title}`}
                  value={choices[t.id] ?? "keep"}
                  onChange={(v) => setChoices((c) => ({ ...c, [t.id]: v }))}
                  options={[
                    { value: "keep", label: "Leave" },
                    { value: "tomorrow", label: "Tomorrow" },
                    { value: "backlog", label: "Backlog" },
                  ]}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Field label="Note to self" hint="Private. Stored only in this browser and never sent anywhere." className="mt-5">
        {(id, d) => <Textarea id={id} aria-describedby={d} rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What went well? What got in the way?" />}
      </Field>
    </Dialog>
  );
}
