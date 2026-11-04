"use client";

/**
 * Goal Studio: classic goal-setting frameworks as interactive canvases. Each
 * template writes real goals, projects and tasks through lib/actions (nothing
 * is faked); the canvas animation only mirrors what the user has typed.
 * Wheel-of-life ratings are a thinking aid and are not stored.
 */
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, Grid3x3, Plus, Route, Sparkles, Target, Trash2, Wand2 } from "lucide-react";
import { createTask, saveGoal, saveProject } from "@/lib/actions";
import { fxBurst } from "@/lib/fx";
import { toast } from "../toast";
import { Button, Field, Input, cx } from "../ui";

type TemplateId = "smart" | "okr" | "mandala" | "wheel" | "roadmap";

const TEMPLATES: { id: TemplateId; title: string; blurb: string; color: string; icon: ReactNode; makes: string }[] = [
  { id: "smart", title: "SMART goal", blurb: "Sharpen one goal until it's specific, measurable and dated.", color: "bg-sticky-pink", icon: <Target size={18} />, makes: "1 goal" },
  { id: "okr", title: "OKR", blurb: "An objective plus 2–5 measurable key results.", color: "bg-sticky-yellow", icon: <Sparkles size={18} />, makes: "1 goal + tasks" },
  { id: "mandala", title: "Mandala chart", blurb: "A core goal surrounded by eight supporting areas.", color: "bg-sticky-green", icon: <Grid3x3 size={18} />, makes: "1 goal + projects" },
  { id: "wheel", title: "Wheel of life", blurb: "Rate eight life areas, then grow the weakest one.", color: "bg-sticky-blue", icon: <Wand2 size={18} />, makes: "1 goal" },
  { id: "roadmap", title: "Goal roadmap", blurb: "Lay dated milestones on a timeline.", color: "bg-sticky-lime", icon: <Route size={18} />, makes: "1 goal + dated tasks" },
];

const isTemplate = (v: string | null): v is TemplateId => !!v && TEMPLATES.some((t) => t.id === v);

/** Shared "it's real now" moment: confetti from the button + a toast that links to Goals. */
function useCelebrate() {
  const router = useRouter();
  return (el: Element | null, message: string) => {
    fxBurst(el);
    toast(message, { action: { label: "View goals", run: () => router.push("/goals") } });
  };
}

// ---------- Studio ----------

/** Reads ?t= on the client so the page can be statically exported. */
export function StudioRoute() {
  return <StudioView initial={useSearchParams().get("t")} />;
}

/** `initial` comes from the URL (/studio?t=mandala), so landing deep links open a template. */
export function StudioView({ initial }: { initial: string | null }) {
  const [open, setOpen] = useState<TemplateId | null>(isTemplate(initial) ? initial : null);
  const reduce = useReducedMotion() ?? false;

  const choose = (id: TemplateId | null) => {
    setOpen(id);
    const url = id ? `?t=${id}` : window.location.pathname; // relative, so it works under the Pages base path
    window.history.replaceState(null, "", url);
  };

  return (
    <div>
      <StudioHero />
      <LayoutGroup>
        <AnimatePresence mode="popLayout" initial={false}>
          {open === null ? (
            <motion.ul key="gallery" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" exit={{ opacity: 0 }} aria-label="Templates">
              {TEMPLATES.map((t, i) => (
                <motion.li
                  key={t.id}
                  initial={reduce ? false : { opacity: 0, y: 40, rotate: i % 2 ? 4 : -4, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 16, delay: i * 0.07 }}
                >
                  <motion.button
                    layoutId={`tpl-${t.id}`}
                    type="button"
                    onClick={() => choose(t.id)}
                    whileHover={reduce ? undefined : { y: -6, rotate: i % 2 ? 1.2 : -1.2 }}
                    whileTap={{ scale: 0.97 }}
                    className={cx("sticky group relative flex h-full min-h-[190px] w-full flex-col justify-between rounded-2xl p-5 text-left text-night", t.color)}
                  >
                    <span className="flex items-center justify-between">
                      <span className="grid size-10 place-items-center rounded-xl bg-night text-sticky-yellow" aria-hidden>
                        {t.icon}
                      </span>
                      <span className="rounded-full bg-night/10 px-2.5 py-1 text-[11px] font-bold">Makes {t.makes}</span>
                    </span>
                    <span>
                      <span className="block font-[family-name:var(--font-display)] text-[24px] leading-tight font-black tracking-tight">{t.title}</span>
                      <span className="mt-1 block text-[14px] font-medium text-night/80">{t.blurb}</span>
                    </span>
                  </motion.button>
                </motion.li>
              ))}
            </motion.ul>
          ) : (
            <motion.div
              key={open}
              layoutId={`tpl-${open}`}
              className="mt-8 overflow-hidden rounded-3xl border-2 border-night bg-panel shadow-[8px_8px_0_0_var(--color-night)]"
              transition={{ type: "spring", stiffness: 210, damping: 26 }}
            >
              <EditorFrame id={open} onBack={() => choose(null)} />
            </motion.div>
          )}
        </AnimatePresence>
      </LayoutGroup>
    </div>
  );
}

function StudioHero() {
  return (
    <motion.section
      aria-labelledby="studio-title"
      className="dot-grid-night relative overflow-hidden rounded-[2rem] bg-night px-6 py-10 text-white sm:px-10 sm:py-14"
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 160, damping: 20 }}
    >
      <div aria-hidden className="aurora pointer-events-none absolute -top-[420px] -right-[300px] size-[900px] rounded-full opacity-40 [mask-image:radial-gradient(circle,black,transparent_60%)]" />
      <div aria-hidden className="pointer-events-none absolute right-8 bottom-8 hidden gap-3 xl:flex">
        {["bg-sticky-yellow", "bg-sticky-pink", "bg-sticky-blue"].map((c, i) => (
          <motion.span
            key={c}
            className={cx("wobble size-16 rounded-md", c)}
            style={{ ["--r" as string]: `${(i - 1) * 6}deg` }}
            initial={{ y: -200, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 180, damping: 12, delay: 0.3 + i * 0.12 }}
          />
        ))}
      </div>
      <p className="relative inline-flex items-center gap-2 rounded-full border border-sticky-yellow/50 px-3 py-1 text-[12px] font-bold tracking-wide text-sticky-yellow uppercase">
        <Sparkles size={14} aria-hidden /> Goal Studio
      </p>
      <h1 id="studio-title" className="relative mt-4 max-w-2xl font-[family-name:var(--font-display)] text-[40px] leading-[0.98] font-black tracking-[-0.045em] sm:text-[60px]">
        Shape a goal. <span className="vivid-text">Ship the plan.</span>
      </h1>
      <p className="relative mt-4 max-w-xl text-[16px] text-white/80">Pick a framework, fill in the canvas, and LifeOS creates the real goal, projects and tasks for you.</p>
    </motion.section>
  );
}

function EditorFrame({ id, onBack }: { id: TemplateId; onBack: () => void }) {
  const t = TEMPLATES.find((x) => x.id === id)!;
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), [id]);
  return (
    <div>
      <div className={cx("flex flex-wrap items-center justify-between gap-3 border-b-2 border-night px-5 py-4 sm:px-7", t.color)}>
        <div className="flex items-center gap-3 text-night">
          <span className="grid size-10 place-items-center rounded-xl bg-night text-sticky-yellow" aria-hidden>
            {t.icon}
          </span>
          <div>
            <h2 ref={headingRef} tabIndex={-1} className="font-[family-name:var(--font-display)] text-[24px] leading-none font-black tracking-tight outline-none">
              {t.title}
            </h2>
            <p className="mt-1 text-[13px] font-medium text-night/75">{t.blurb}</p>
          </div>
        </div>
        <button type="button" onClick={onBack} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-night px-3 text-[13px] font-bold text-white transition-transform hover:-translate-x-0.5 active:scale-95">
          <ArrowLeft size={15} aria-hidden /> All templates
        </button>
      </div>
      <motion.div className="p-5 sm:p-7" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.4 }}>
        {id === "smart" ? <SmartEditor /> : id === "okr" ? <OkrEditor /> : id === "mandala" ? <MandalaEditor /> : id === "wheel" ? <WheelEditor /> : <RoadmapEditor />}
      </motion.div>
    </div>
  );
}

function CreateBar({ disabled, hint, onCreate, label }: { disabled: boolean; hint: string; onCreate: (el: HTMLButtonElement) => void; label: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
      <p className="text-[13px] text-ink-3">{hint}</p>
      <Button ref={ref} variant="primary" size="lg" disabled={disabled} onClick={() => ref.current && onCreate(ref.current)}>
        <Sparkles size={16} aria-hidden /> {label}
      </Button>
    </div>
  );
}

// ---------- SMART ----------

const SMART = [
  { key: "s", letter: "S", word: "Specific", color: "bg-sticky-pink", label: "Specific — what exactly will you achieve?", ph: "Run a half marathon" },
  { key: "m", letter: "M", word: "Measurable", color: "bg-sticky-yellow", label: "Measurable — how will you know it's done?", ph: "Finish 21.1 km under 2:15" },
  { key: "a", letter: "A", word: "Achievable", color: "bg-sticky-green", label: "Achievable — why is this realistic?", ph: "I already run 10 km comfortably" },
  { key: "r", letter: "R", word: "Relevant", color: "bg-sticky-blue", label: "Relevant — why does it matter to you?", ph: "Energy and a reason to train" },
] as const;

function SmartEditor() {
  const celebrate = useCelebrate();
  const [v, setV] = useState({ s: "", m: "", a: "", r: "", t: "" });
  const filled = [v.s, v.m, v.a, v.r, v.t].map((x) => x.trim().length > 0);
  const count = filled.filter(Boolean).length;
  const create = (el: HTMLButtonElement) => {
    const why = [v.m && `Measure: ${v.m}`, v.a && `Achievable because: ${v.a}`, v.r && `Why it matters: ${v.r}`].filter(Boolean).join("\n");
    const r = saveGoal(null, { title: v.s, why, targetDate: v.t || null, status: "active" });
    if (!r.ok) return toast(r.errors.title ?? "Couldn't create the goal.", { tone: "error" });
    celebrate(el, "SMART goal created.");
    setV({ s: "", m: "", a: "", r: "", t: "" });
  };
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
      <div className="grid gap-4">
        {SMART.map((f) => (
          <Field key={f.key} label={f.label}>
            {(id, d) => <Input id={id} aria-describedby={d} value={v[f.key]} placeholder={f.ph} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} maxLength={f.key === "s" ? 200 : 400} />}
          </Field>
        ))}
        <Field label="Time-bound — by when?">{(id, d) => <Input id={id} aria-describedby={d} type="date" value={v.t} onChange={(e) => setV({ ...v, t: e.target.value })} className="w-fit" />}</Field>
      </div>
      <div aria-hidden className="flex flex-col items-center justify-center gap-5 rounded-2xl bg-night p-6" style={{ perspective: 700 }}>
        <div className="flex gap-1.5">
          {[...SMART, { key: "t", letter: "T", word: "Time-bound", color: "bg-sticky-lime" }].map((f, i) => (
            <motion.div
              key={f.key}
              className={cx("flex size-12 items-center justify-center rounded-lg font-[family-name:var(--font-display)] text-[26px] font-black", filled[i] ? cx(f.color, "text-night") : "bg-white/10 text-white/40")}
              animate={{ rotateY: filled[i] ? 360 : 0, scale: filled[i] ? [1, 1.25, 1] : 1 }}
              transition={{ rotateY: { type: "spring", stiffness: 160, damping: 14 }, scale: { duration: 0.45, ease: "easeOut" } }}
            >
              {f.letter}
            </motion.div>
          ))}
        </div>
        <p className="text-center text-[15px] font-bold text-white">
          {count === 5 ? <span className="vivid-text">Perfectly SMART.</span> : `${count} of 5 filled`}
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div className="dayline-fill h-full origin-left rounded-full" animate={{ scaleX: count / 5 }} transition={{ type: "spring", stiffness: 120, damping: 18 }} />
        </div>
      </div>
      <div className="lg:col-span-2">
        <CreateBar disabled={!v.s.trim()} hint="Specific becomes the goal name; the rest is saved as its why." label="Create goal" onCreate={create} />
      </div>
    </div>
  );
}

// ---------- OKR ----------

function OkrEditor() {
  const celebrate = useCelebrate();
  const [objective, setObjective] = useState("");
  const [date, setDate] = useState("");
  const [krs, setKrs] = useState<string[]>(["", "", ""]);
  const ready = krs.filter((k) => k.trim()).length;
  const create = (el: HTMLButtonElement) => {
    const g = saveGoal(null, { title: objective, why: "Objective (OKR)", targetDate: date || null, status: "active" });
    if (!g.ok) return toast(g.errors.title ?? "Couldn't create the goal.", { tone: "error" });
    let n = 0;
    for (const k of krs) if (k.trim() && createTask({ title: `KR: ${k.trim()}`, goalId: g.id, dueDate: date || null, priority: "high" }).ok) n++;
    celebrate(el, `Objective created with ${n} key result${n === 1 ? "" : "s"} as tasks.`);
    setObjective("");
    setDate("");
    setKrs(["", "", ""]);
  };
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <Field label="Objective — the inspiring direction">{(id, d) => <Input id={id} aria-describedby={d} value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Grow the newsletter" maxLength={200} />}</Field>
        <Field label="Target date">{(id, d) => <Input id={id} aria-describedby={d} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
      </div>
      <div>
        <p className="mb-2 text-[13px] font-semibold text-ink-2">Key results — measurable outcomes</p>
        <ul className="grid gap-2.5">
          <AnimatePresence initial={false}>
            {krs.map((k, i) => (
              <motion.li key={i} layout initial={{ opacity: 0, x: -30, height: 0 }} animate={{ opacity: 1, x: 0, height: "auto" }} exit={{ opacity: 0, x: 30, height: 0 }} className="flex items-center gap-2">
                <span className={cx("grid size-9 shrink-0 place-items-center rounded-lg text-[13px] font-black transition-colors", k.trim() ? "bg-sticky-yellow text-night" : "bg-hover text-ink-3")} aria-hidden>
                  KR{i + 1}
                </span>
                <Input aria-label={`Key result ${i + 1}`} value={k} onChange={(e) => setKrs(krs.map((x, j) => (j === i ? e.target.value : x)))} placeholder={["Publish 12 posts", "Reach 1,000 readers", "Guest on 2 podcasts", "Grow open rate to 50%", "Launch a referral offer"][i]} maxLength={200} />
                {krs.length > 2 ? (
                  <button type="button" aria-label={`Remove key result ${i + 1}`} onClick={() => setKrs(krs.filter((_, j) => j !== i))} className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-rose/10 hover:text-rose">
                    <Trash2 size={15} aria-hidden />
                  </button>
                ) : null}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        {krs.length < 5 ? (
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setKrs([...krs, ""])}>
            <Plus size={14} aria-hidden /> Add key result
          </Button>
        ) : null}
      </div>
      <CreateBar disabled={!objective.trim()} hint={`Creates the objective as a goal and ${ready} key result task${ready === 1 ? "" : "s"} linked to it.`} label="Create OKR" onCreate={create} />
    </div>
  );
}

// ---------- Mandala ----------

const AREA_COLORS = ["bg-sticky-pink", "bg-sticky-yellow", "bg-sticky-green", "bg-sticky-blue", "bg-sticky-orange", "bg-sticky-lime", "bg-sticky-green", "bg-sticky-pink"];
// Grid positions (0–8) of the eight areas around the center (4).
const RING = [0, 1, 2, 5, 8, 7, 6, 3];

function MandalaEditor() {
  const celebrate = useCelebrate();
  const reduce = useReducedMotion() ?? false;
  const [core, setCore] = useState("");
  const [areas, setAreas] = useState<string[]>(Array(8).fill(""));
  const filled = areas.filter((a) => a.trim()).length;
  const create = (el: HTMLButtonElement) => {
    const g = saveGoal(null, { title: core, why: "Mandala chart", targetDate: null, status: "active" });
    if (!g.ok) return toast(g.errors.title ?? "Couldn't create the goal.", { tone: "error" });
    let n = 0;
    for (const a of areas) if (a.trim() && saveProject(null, { title: a.trim(), notes: "", goalId: g.id, dueDate: null, status: "active" }).ok) n++;
    celebrate(el, `Goal created with ${n} supporting project${n === 1 ? "" : "s"}.`);
    setCore("");
    setAreas(Array(8).fill(""));
  };
  return (
    <div>
      <div className="mx-auto grid max-w-[640px] grid-cols-3 gap-2.5 sm:gap-3.5">
        {Array.from({ length: 9 }, (_, cell) => {
          if (cell === 4) {
            return (
              <motion.div key="core" className="sticky relative flex aspect-square flex-col justify-center rounded-xl bg-night p-2.5 sm:p-4" animate={core.trim() && !reduce ? { scale: [1, 1.06, 1] } : undefined} transition={{ duration: 0.4 }}>
                <label htmlFor="mandala-core" className="mb-1 text-[10px] font-black tracking-widest text-sticky-yellow uppercase sm:text-[11px]">
                  Core goal
                </label>
                <textarea
                  id="mandala-core"
                  value={core}
                  onChange={(e) => setCore(e.target.value)}
                  maxLength={200}
                  placeholder="Become a confident cook"
                  className="h-full w-full resize-none bg-transparent text-[13px] leading-tight font-bold text-white placeholder:text-white/40 focus:outline-none sm:text-[17px]"
                />
              </motion.div>
            );
          }
          const i = RING.indexOf(cell);
          const val = areas[i]!;
          const r = Math.floor(cell / 3) - 1;
          const c = (cell % 3) - 1;
          return (
            <motion.div
              key={cell}
              initial={reduce ? false : { x: -c * 60, y: -r * 60, scale: 0.3, opacity: 0 }}
              animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 15, delay: 0.1 + i * 0.05 }}
              className={cx("sticky relative flex aspect-square flex-col rounded-xl p-2.5 transition-[filter] sm:p-4", AREA_COLORS[i], !val.trim() && "saturate-[0.55]")}
            >
              <label htmlFor={`mandala-${i}`} className="mb-1 text-[10px] font-black tracking-widest text-night/60 uppercase sm:text-[11px]">
                Area {i + 1}
              </label>
              <textarea
                id={`mandala-${i}`}
                value={val}
                onChange={(e) => setAreas(areas.map((a, j) => (j === i ? e.target.value : a)))}
                maxLength={200}
                placeholder={["Knife skills", "Weekly meal plan", "Learn 10 recipes", "Spices", "Host a dinner", "Bread", "Budget", "Kitchen setup"][i]}
                className="h-full w-full resize-none bg-transparent text-[12px] leading-tight font-bold text-night placeholder:text-night/35 focus:outline-none sm:text-[15px]"
              />
            </motion.div>
          );
        })}
      </div>
      <CreateBar disabled={!core.trim()} hint={`Creates the core goal and ${filled} project${filled === 1 ? "" : "s"} linked to it. Break each project into tasks on the Goals page.`} label="Create mandala" onCreate={create} />
    </div>
  );
}

// ---------- Wheel of life ----------

const LIFE_AREAS = ["Health", "Career", "Money", "People", "Growth", "Fun", "Home", "Mind"];

function WheelEditor() {
  const celebrate = useCelebrate();
  const uid = useId();
  const [scores, setScores] = useState<number[]>([6, 6, 6, 6, 6, 6, 6, 6]);
  const lowest = useMemo(() => scores.indexOf(Math.min(...scores)), [scores]);
  const [title, setTitle] = useState("");
  const [touched, setTouched] = useState(false);
  const suggested = `Raise ${LIFE_AREAS[lowest]} from ${scores[lowest]} to ${Math.min(10, scores[lowest]! + 2)}`;
  const goalTitle = touched ? title : suggested;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const C = 150;
  const R = 120;
  const pt = (i: number, v: number) => {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    return [C + Math.cos(a) * (v / 10) * R, C + Math.sin(a) * (v / 10) * R] as const;
  };
  const poly = scores.map((v, i) => pt(i, v).join(",")).join(" ");
  const create = (el: HTMLButtonElement) => {
    const why = `Wheel of life: ${LIFE_AREAS.map((a, i) => `${a} ${scores[i]}`).join(", ")}.`;
    const r = saveGoal(null, { title: goalTitle, why, targetDate: null, status: "active" });
    if (!r.ok) return toast(r.errors.title ?? "Couldn't create the goal.", { tone: "error" });
    celebrate(el, `Goal created for ${LIFE_AREAS[lowest]}.`);
    setTouched(false);
    setTitle("");
  };
  return (
    <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,360px)_1fr]">
      <div className="relative mx-auto w-full max-w-[360px] rounded-[2rem] bg-night p-3" aria-hidden>
        <svg viewBox="-24 -6 348 312" className="w-full">
          <defs>
            <radialGradient id={`${uid}-g`}>
              <stop offset="0" stopColor="#ffd84d" stopOpacity="0.9" />
              <stop offset="1" stopColor="#ff5a36" stopOpacity="0.55" />
            </radialGradient>
          </defs>
          {[2, 4, 6, 8, 10].map((v) => (
            <circle key={v} cx={C} cy={C} r={(v / 10) * R} fill="none" stroke="rgb(255 255 255 / 0.12)" />
          ))}
          {LIFE_AREAS.map((a, i) => {
            const [x, y] = pt(i, 10);
            const [lx, ly] = pt(i, 11.6);
            return (
              <g key={a}>
                <line x1={C} y1={C} x2={x} y2={y} stroke="rgb(255 255 255 / 0.12)" />
                <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="700" fill={i === lowest ? "#ffd84d" : "rgb(255 255 255 / 0.8)"}>
                  {a}
                </text>
              </g>
            );
          })}
          <motion.polygon points={poly} fill={`url(#${uid}-g)`} stroke="#ffd84d" strokeWidth="2.5" strokeLinejoin="round" animate={{ points: poly }} transition={{ type: "spring", stiffness: 140, damping: 14 }} />
          {scores.map((v, i) => {
            const [x, y] = pt(i, v);
            return <motion.circle key={i} r={i === lowest ? 7 : 5} fill={i === lowest ? "#ff9ec7" : "#fff"} animate={{ cx: x, cy: y }} transition={{ type: "spring", stiffness: 140, damping: 14 }} />;
          })}
          <text x={C} y={C + 4} textAnchor="middle" fontSize="13" fontWeight="900" fill="#12301f" className="tabular">
            {avg.toFixed(1)}
          </text>
        </svg>
      </div>
      <div>
        <p className="mb-3 text-[13px] text-ink-3">Rate each area from 1 (struggling) to 10 (thriving). Ratings aren&apos;t saved — they help you choose a goal.</p>
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {LIFE_AREAS.map((a, i) => (
            <label key={a} className="block">
              <span className="flex justify-between text-[13px] font-semibold text-ink-2">
                <span className={cx(i === lowest && "text-hot")}>{a}</span>
                <span className="tabular font-black text-ink">{scores[i]}</span>
              </span>
              <input type="range" min={1} max={10} value={scores[i]} onChange={(e) => setScores(scores.map((s, j) => (j === i ? Number(e.target.value) : s)))} className="mt-1 w-full accent-electric" />
            </label>
          ))}
        </div>
        <div className="mt-5 rounded-2xl border-2 border-dashed border-hot/40 bg-sticky-pink/20 p-4">
          <Field label={`Goal for your lowest area (${LIFE_AREAS[lowest]})`}>
            {(id, d) => (
              <Input
                id={id}
                aria-describedby={d}
                value={goalTitle}
                maxLength={200}
                onChange={(e) => {
                  setTouched(true);
                  setTitle(e.target.value);
                }}
              />
            )}
          </Field>
        </div>
        <CreateBar disabled={!goalTitle.trim()} hint="Saves the goal with your ratings in its why." label="Create goal" onCreate={create} />
      </div>
    </div>
  );
}

// ---------- Roadmap ----------

type Milestone = { title: string; date: string };

function RoadmapEditor() {
  const celebrate = useCelebrate();
  const [goal, setGoal] = useState("");
  const [ms, setMs] = useState<Milestone[]>([
    { title: "", date: "" },
    { title: "", date: "" },
    { title: "", date: "" },
  ]);
  const shown = ms.filter((m) => m.title.trim());
  const sorted = [...shown].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  const last = sorted.reduce<string>((acc, m) => (m.date > acc ? m.date : acc), "");
  const create = (el: HTMLButtonElement) => {
    const g = saveGoal(null, { title: goal, why: "Goal roadmap", targetDate: last || null, status: "active" });
    if (!g.ok) return toast(g.errors.title ?? "Couldn't create the goal.", { tone: "error" });
    let n = 0;
    for (const m of sorted) if (createTask({ title: m.title.trim(), goalId: g.id, dueDate: m.date || null, priority: "medium" }).ok) n++;
    celebrate(el, `Roadmap created with ${n} milestone${n === 1 ? "" : "s"}.`);
    setGoal("");
    setMs([
      { title: "", date: "" },
      { title: "", date: "" },
      { title: "", date: "" },
    ]);
  };
  const W = 600;
  const pts = sorted.map((_, i) => [40 + (sorted.length === 1 ? (W - 80) / 2 : (i / (sorted.length - 1)) * (W - 80)), i % 2 ? 50 : 100] as const);
  const d = pts.length > 1 ? pts.map(([x, y], i) => (i === 0 ? `M${x} ${y}` : `S ${x - 40} ${y}, ${x} ${y}`)).join(" ") : "";
  return (
    <div className="grid gap-6">
      <Field label="Goal at the end of the road">{(id, dd) => <Input id={id} aria-describedby={dd} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Launch my portfolio site" maxLength={200} />}</Field>
      <div className="dot-grid overflow-hidden rounded-2xl border border-line bg-[#fffdf6] p-3" aria-hidden>
        <svg viewBox={`0 0 ${W} 160`} className="w-full">
          <defs>
            <linearGradient id="road-ed" x1="0" x2="1">
              <stop offset="0" stopColor="#0f6b5c" />
              <stop offset="0.5" stopColor="#ff5a36" />
              <stop offset="1" stopColor="#ffb36b" />
            </linearGradient>
          </defs>
          {d ? <motion.path key={d} d={d} fill="none" stroke="url(#road-ed)" strokeWidth="6" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} /> : null}
          <AnimatePresence>
            {sorted.map((m, i) => {
              const [x, y] = pts[i]!;
              return (
                <motion.g key={m.title + i} initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 260, damping: 14, delay: i * 0.08 }}>
                  <circle cx={x} cy={y} r="11" fill="#ffd84d" stroke="#12301f" strokeWidth="3" />
                  <text x={x} y={y + 30} textAnchor="middle" fontSize="12" fontWeight="800" fill="#1d1a16">
                    {m.title.length > 18 ? `${m.title.slice(0, 17)}…` : m.title}
                  </text>
                  {m.date ? (
                    <text x={x} y={y - 18} textAnchor="middle" fontSize="10" fontWeight="700" fill="#6b6357">
                      {m.date}
                    </text>
                  ) : null}
                </motion.g>
              );
            })}
          </AnimatePresence>
          {sorted.length === 0 ? (
            <text x={W / 2} y={84} textAnchor="middle" fontSize="13" fill="#6b6357">
              Add milestones and watch the road draw itself
            </text>
          ) : null}
        </svg>
      </div>
      <ul className="grid gap-2.5">
        {ms.map((m, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-night text-[13px] font-black text-sticky-yellow" aria-hidden>
              {i + 1}
            </span>
            <Input aria-label={`Milestone ${i + 1}`} value={m.title} onChange={(e) => setMs(ms.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder={["Pick a design", "Write case studies", "Go live", "Share it", "Collect feedback", "Iterate"][i]} maxLength={200} className="min-w-0 flex-1" />
            <Input aria-label={`Milestone ${i + 1} date`} type="date" value={m.date} onChange={(e) => setMs(ms.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} className="w-[160px]" />
            {ms.length > 1 ? (
              <button type="button" aria-label={`Remove milestone ${i + 1}`} onClick={() => setMs(ms.filter((_, j) => j !== i))} className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-rose/10 hover:text-rose">
                <Trash2 size={15} aria-hidden />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {ms.length < 6 ? (
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => setMs([...ms, { title: "", date: "" }])}>
          <Plus size={14} aria-hidden /> Add milestone
        </Button>
      ) : null}
      <CreateBar disabled={!goal.trim()} hint={`Creates the goal (due on the last milestone) and ${shown.length} dated task${shown.length === 1 ? "" : "s"}.`} label="Create roadmap" onCreate={create} />
    </div>
  );
}
