"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// ---------- Buttons ----------

type Variant = "primary" | "secondary" | "ghost" | "danger" | "quiet";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-ink text-canvas font-semibold border-2 border-ink shadow-[3px_3px_0_0_var(--color-tomato)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[5px_5px_0_0_var(--color-tomato)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_0_var(--color-tomato)]",
  secondary: "bg-panel text-ink border-2 border-ink shadow-[3px_3px_0_0_#1d1a16] hover:-translate-x-px hover:-translate-y-px hover:bg-sticky-yellow hover:shadow-[5px_5px_0_0_#1d1a16]",
  ghost: "text-ink-2 hover:text-ink hover:bg-hover",
  quiet: "text-ink-3 hover:text-ink",
  danger: "bg-rose/15 text-rose border border-rose/30 hover:bg-rose/25",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-2.5 text-[13px] gap-1.5 rounded-lg",
  md: "h-9 px-3.5 text-sm gap-2 rounded-lg",
  lg: "h-11 px-5 text-[15px] gap-2 rounded-xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        // Press feedback is a tiny transform: no layout shift, same on touch, mouse and keyboard (:active).
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-[color,background-color,border-color,opacity,transform,box-shadow] duration-150 ease-[var(--ease-soft)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    />
  );
});

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-hover hover:text-ink disabled:opacity-40",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

// ---------- Layout bits ----------

export function Card({
  className,
  children,
  as: As = "section",
  lift,
  ...rest
}: { className?: string; children: ReactNode; as?: "section" | "div" | "article"; /** Hover/focus lift with a light sheen. */ lift?: boolean } & Record<string, unknown>) {
  return (
    <As className={cx("rounded-3xl border-2 border-ink bg-panel p-5 shadow-[3px_3px_0_0_#1d1a16]", lift && "lift", className)} {...rest}>
      {children}
    </As>
  );
}

export function SectionTitle({ children, action, id, hint }: { children: ReactNode; action?: ReactNode; id?: string; hint?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="text-[13px] font-medium text-ink-2">
          {children}
        </h2>
        {hint ? <p className="mt-0.5 text-xs text-ink-3">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-[family-name:var(--font-display)] text-[32px] leading-tight font-black tracking-[-0.03em] text-ink sm:text-[42px]">
          {typeof title === "string" ? <KineticTitle text={title} /> : title}
        </h1>
        {subtitle ? (
          <motion.p className="mt-1 text-sm text-ink-3" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.4 }}>
            {subtitle}
          </motion.p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "sage" | "amber" | "rose" | "sky" | "violet"; className?: string }) {
  const tones = {
    neutral: "bg-ink/5 text-ink-2 border-line",
    sage: "bg-sage/10 text-sage border-sage/25",
    amber: "bg-amber/10 text-amber border-amber/25",
    rose: "bg-rose/10 text-rose border-rose/25",
    sky: "bg-sky/10 text-sky border-sky/25",
    violet: "bg-violet/10 text-violet border-violet/25",
  };
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] leading-4 font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

/** Page titles rise in letter by letter, hop on hover, and get a hand-drawn underline (screen readers get the plain text). */
function KineticTitle({ text }: { text: string }) {
  return (
    <span className="relative inline-block pb-1">
      <span className="sr-only">{text}</span>
      {Array.from(text).map((ch, i) => (
        <motion.span
          key={i}
          aria-hidden
          className="inline-block whitespace-pre"
          initial={{ opacity: 0, y: "0.5em", rotate: 8 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          whileHover={{ y: "-0.14em", rotate: i % 2 ? 6 : -6, color: "#b8320f" }}
          transition={{ type: "spring", stiffness: 380, damping: 22, delay: i * 0.03 }}
        >
          {ch}
        </motion.span>
      ))}
      <svg aria-hidden viewBox="0 0 300 20" preserveAspectRatio="none" className="pointer-events-none absolute -bottom-1 left-0 h-[0.22em] w-full overflow-visible">
        <motion.path
          d="M4 12 C 70 2, 130 20, 190 9 S 270 5, 296 12"
          fill="none"
          stroke="#ff5a36"
          strokeWidth="5"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, delay: 0.25 + text.length * 0.03, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
    </span>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <motion.div
      className="flex flex-col items-center rounded-2xl border-2 border-dashed border-ink/40 bg-panel px-6 py-8 text-center"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
    >
      {icon ? (
        <div className="float-y mb-3 grid size-11 place-items-center rounded-2xl border-2 border-ink bg-sticky-yellow text-ink">{icon}</div>
      ) : null}
      <p className="text-sm font-medium text-ink">{title}</p>
      {children ? <div className="mt-1 max-w-sm text-[13px] text-ink-3">{children}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </motion.div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("dayline-shimmer rounded-2xl opacity-[0.18]", className)} />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line-strong bg-raised px-1.5 py-px font-mono text-[11px] text-ink-2">{children}</kbd>;
}

// ---------- Progress ----------

export function ProgressRing({
  value,
  size = 56,
  stroke = 5,
  color = "var(--color-sage)",
  label,
  children,
  timing = "settle",
  head = false,
  gradient,
}: {
  value: number | null;
  size?: number;
  stroke?: number;
  color?: string;
  label: string;
  children?: ReactNode;
  /** "settle": eased move to a new value. "linear": continuous progress (timers). */
  timing?: "settle" | "linear";
  /** Show the Dayline head at the leading edge. */
  head?: boolean;
  /** Paint the arc with a pastel gradient instead of a flat color. */
  gradient?: [string, string];
}) {
  const gid = useId();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = value === null ? 0 : Math.min(1, Math.max(0, value));
  const transition = timing === "linear" ? "1000ms linear" : "800ms var(--ease-spring)";
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="-rotate-90 overflow-visible">
        {gradient ? (
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={gradient[0]} style={{ transition: "stop-color 800ms" }} />
              <stop offset="1" stopColor={gradient[1]} style={{ transition: "stop-color 800ms" }} />
            </linearGradient>
          </defs>
        ) : null}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(29 26 22 / 0.07)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={gradient ? `url(#${gid})` : color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: `stroke-dashoffset ${transition}, stroke ${600}ms var(--ease-soft)`, opacity: value === null ? 0 : 1 }}
        />
      </svg>
      {head && value !== null && v > 0 && v < 1 ? (
        // Rotating wrapper keeps the head on the arc's leading edge (transform only).
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ transform: `rotate(${v * 360}deg)`, transition: `transform ${transition}` }}>
          <span className="dayline-head absolute left-1/2 rounded-full" style={{ width: stroke + 4, height: stroke + 4, top: stroke / 2 - (stroke + 4) / 2, marginLeft: -(stroke + 4) / 2 }} />
        </div>
      ) : null}
      {children ? <div className="absolute inset-0 flex items-center justify-center">{children}</div> : null}
    </div>
  );
}

/**
 * Shows `value` and, when it changes, rolls the old figure out and the new one in.
 * The text is always the real current value (no count-up), so assistive tech and
 * reduced-motion users get it immediately.
 */
export function AnimatedNumber({ value, className }: { value: string | number; className?: string }) {
  const reduce = useReducedMotion();
  // Previous value kept in state and updated during render (React's "store info from previous renders").
  const [last, setLast] = useState({ value, up: true });
  if (last.value !== value) {
    setLast({ value, up: typeof value === "number" && typeof last.value === "number" ? value >= last.value : true });
  }
  const up = last.up;
  return (
    <span className={cx("relative inline-flex overflow-hidden align-bottom", className)}>
      {/* Assistive tech reads only the settled value, never the outgoing figure. */}
      <span className="sr-only">{value}</span>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={String(value)}
          aria-hidden
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: up ? "60%" : "-60%" }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: up ? "-60%" : "60%" }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          className="inline-block"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function ProgressBar({ value, color = "bg-sage", label }: { value: number | null; color?: string; label: string }) {
  const v = value === null ? 0 : Math.min(1, Math.max(0, value));
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} className="h-2 overflow-hidden rounded-full bg-ink/[0.06]">
      <div className={cx("relative h-full overflow-hidden rounded-full transition-[width] duration-700 ease-[var(--ease-spring)]", color)} style={{ width: `${v * 100}%` }}>
        {/* A light glint sweeps across the filled part. */}
        <span aria-hidden className="glint absolute inset-y-0 w-1/3 bg-linear-90 from-transparent via-white/60 to-transparent" />
      </div>
    </div>
  );
}

// ---------- Completion checkbox ----------

export function CheckButton({
  checked,
  onToggle,
  label,
  tone = "sage",
  size = 20,
}: {
  checked: boolean;
  /** Receives the click so callers can start effects (e.g. a trail) from this element. */
  onToggle: (e: React.MouseEvent<HTMLButtonElement>) => void;
  label: string;
  tone?: "sage" | "amber" | "violet" | "sky";
  size?: number;
}) {
  const reduce = useReducedMotion();
  const colors = { sage: "var(--color-sage)", amber: "var(--color-amber)", violet: "var(--color-violet)", sky: "var(--color-sky)" };
  const petals = { sage: "#6fd0a2", amber: "#f2b75a", violet: "#5cc0a5", sky: "#ff8fa3" };
  const color = colors[tone];
  // Count transitions to checked (during render, not on mount) to key a one-shot bloom.
  const [bloom, setBloom] = useState({ checked, n: 0 });
  if (bloom.checked !== checked) setBloom({ checked, n: checked ? bloom.n + 1 : bloom.n });
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      whileTap={reduce ? undefined : { scale: 0.86 }}
      // A small pop only when becoming checked; unchecking just eases back. Never on first paint.
      initial={false}
      animate={reduce ? undefined : checked ? { scale: [1, 1.18, 1] } : { scale: 1 }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      className="relative inline-flex shrink-0 items-center justify-center rounded-full border transition-colors duration-200"
      style={{ width: size, height: size, borderColor: checked ? color : "rgb(29 26 22 / 0.32)", background: checked ? color : "transparent" }}
    >
      <svg viewBox="0 0 16 16" width={size * 0.62} height={size * 0.62} aria-hidden>
        <motion.path
          d="M3.5 8.5l3 3 6-7"
          fill="none"
          stroke="#ffffff"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ duration: reduce ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      {/* Bloom: a ring and six petals burst once each time it becomes checked. */}
      {!reduce && bloom.n > 0 ? (
        <span key={bloom.n} aria-hidden className="pointer-events-none absolute inset-0">
          <motion.span
            className="absolute inset-0 rounded-full border-2"
            style={{ borderColor: petals[tone] }}
            initial={{ scale: 1, opacity: 0.9 }}
            animate={{ scale: 2.4, opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />
          {Array.from({ length: 6 }, (_, i) => {
            const a = (i / 6) * Math.PI * 2;
            return (
              <motion.span
                key={i}
                className="absolute top-1/2 left-1/2 size-1.5 rounded-full"
                style={{ background: petals[tone], marginLeft: -3, marginTop: -3 }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{ x: Math.cos(a) * size * 1.1, y: Math.sin(a) * size * 1.1, opacity: 0, scale: 0.4 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              />
            );
          })}
        </span>
      ) : null}
    </motion.button>
  );
}

// ---------- Dialog ----------

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const reduce = useReducedMotion();
  const closing = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
    closing.current = false;
    el.removeAttribute("data-closing");
  }, [open]);
  /**
   * Esc, backdrop and the close button dismiss with a short exit. Nothing is
   * saved or discarded by this path, so the 140 ms wait changes no data.
   * Save/cancel buttons close through their own handlers immediately.
   */
  const dismiss = () => {
    const el = ref.current;
    if (!el || reduce) return onClose();
    if (closing.current) return;
    closing.current = true;
    el.setAttribute("data-closing", "");
    window.setTimeout(onClose, 140);
  };
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        dismiss();
      }}
      onClick={(e) => {
        if (e.target === ref.current) dismiss();
      }}
      className={cx(
        "m-auto max-h-[min(88dvh,820px)] w-[calc(100vw-24px)] overflow-hidden rounded-2xl border-2 border-ink bg-panel p-0 text-ink shadow-[8px_8px_0_0_#1d1a16] backdrop:bg-[#1d1a16]/30",
        wide ? "max-w-2xl" : "max-w-lg",
      )}
    >
      {open ? (
        <div className="flex max-h-[min(88dvh,820px)] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <h2 id={titleId} className="font-[family-name:var(--font-display)] text-[20px] font-black tracking-[-0.02em]">
                {title}
              </h2>
              {description ? <div className="mt-0.5 text-[13px] text-ink-3">{description}</div> : null}
            </div>
            <IconButton label="Close" onClick={dismiss} className="-mr-1.5 -mt-1">
              <X size={16} />
            </IconButton>
          </div>
          <div className="scrollbar-thin overflow-y-auto px-5 py-4">{children}</div>
          {footer ? <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}

// ---------- Form fields ----------

const control =
  "w-full rounded-lg border-2 border-ink/25 bg-panel px-3 text-sm text-ink placeholder:text-ink-3 transition-colors hover:border-ink/25 focus:border-sage/60 focus:outline-none focus-visible:outline-2 focus-visible:outline-sage/70 aria-[invalid=true]:border-rose/60";

export function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: ReactNode; children: (id: string, describedBy?: string) => ReactNode; className?: string }) {
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {children(id, error || hint ? msgId : undefined)}
      {error ? (
        <p id={msgId} role="alert" className="text-xs text-rose">
          {error}
        </p>
      ) : hint ? (
        <p id={msgId} className="text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(control, "h-9", className)} {...rest} />;
});

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(control, "min-h-20 py-2 leading-relaxed", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(control, "h-9 pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  label: string;
  size?: "sm" | "md";
}) {
  const pillId = useId();
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex w-fit rounded-xl border-2 border-ink bg-panel p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              const i = options.findIndex((x) => x.value === value);
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                const next = options[(i + (e.key === "ArrowRight" ? 1 : options.length - 1)) % options.length]!;
                onChange(next.value);
                (e.currentTarget.parentElement?.children[options.indexOf(next)] as HTMLElement | undefined)?.focus();
              }
            }}
            tabIndex={active ? 0 : -1}
            className={cx(
              "relative rounded-lg font-medium transition-colors",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-[13px]",
              active ? "text-ink" : "text-ink-3 hover:text-ink",
            )}
          >
            {/* The selection pill travels to the chosen option. */}
            {active ? <motion.span layoutId={pillId} className="absolute inset-0 rounded-lg border-2 border-ink bg-sticky-yellow shadow-[2px_2px_0_0_#1d1a16]" transition={{ type: "spring", stiffness: 420, damping: 32 }} /> : null}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: ReactNode }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-sm text-ink">
          {label}
        </label>
        {description ? <p className="mt-0.5 text-xs text-ink-3">{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx("relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors duration-300", checked ? "border-ink bg-sticky-green" : "border-ink/40 bg-ink/10")}
      >
        <motion.span
          className="absolute top-[3px] left-0 size-4 rounded-full bg-white shadow-[0_2px_6px_rgb(29_26_22/0.3)]"
          initial={false}
          animate={{ x: checked ? 23 : 3, scaleX: [1, 1.25, 1] }}
          transition={{ x: { type: "spring", stiffness: 520, damping: 28 }, scaleX: { duration: 0.3, times: [0, 0.4, 1] } }}
        />
      </button>
    </div>
  );
}
