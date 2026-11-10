"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import Shuffle from "../bits/Shuffle";
import { Draggable, MOTION_OK, ScrollTrigger, SplitText, gsap, useGSAP } from "./gsap";

const pad = (n: number) => String(n).padStart(2, "0");

/** Heading whose characters spring up out of word masks when it scrolls into view. */
export function SplitHeading({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useGSAP(
    () => {
      gsap.matchMedia().add(MOTION_OK, () => {
        SplitText.create(ref.current!, {
          type: "words,chars",
          mask: "words",
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(self.chars, {
              yPercent: 120,
              rotation: 14,
              duration: 0.8,
              ease: "back.out(1.8)",
              stagger: 0.022,
              scrollTrigger: { trigger: ref.current, start: "top 85%", once: true },
            }),
        });
      });
    },
    { scope: ref },
  );
  return (
    <h2 ref={ref} id={id} className={className}>
      {children}
    </h2>
  );
}

/* ------------------------------------------------------------------ */
/* Day clock: scroll drives the hands from 06:00 to 22:00, the room    */
/* changes from sunrise yellow to sunset orange to night, and example  */
/* time blocks arrive and get struck through as the hours pass.        */
/* ------------------------------------------------------------------ */

const BLOCKS = [
  { h: 7, label: "Run 5k", tone: "bg-sticky-green" },
  { h: 9, label: "Deep work", tone: "bg-sticky-yellow" },
  { h: 13, label: "Lunch walk", tone: "bg-sticky-orange" },
  { h: 17, label: "Read 20 pages", tone: "bg-sticky-pink" },
  { h: 21, label: "Wind down", tone: "bg-sticky-lime" },
];

export function DayClock() {
  const root = useRef<HTMLElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      gsap.matchMedia().add(MOTION_OK, () => {
        const clock = { h: 6 };
        gsap.set(".dc-hour", { svgOrigin: "200 200", rotation: 180 });
        gsap.set(".dc-min", { svgOrigin: "200 200", rotation: 0 });
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: { trigger: root.current, start: "top top", end: "bottom bottom", scrub: 0.7 },
        });
        tl.to(
          clock,
          {
            h: 22,
            duration: 16,
            onUpdate: () => {
              const h = Math.floor(clock.h);
              const m = Math.floor(((clock.h % 1) * 60) / 5) * 5;
              if (timeRef.current) timeRef.current.textContent = `${pad(h)}:${pad(m)}`;
            },
          },
          0,
        )
          .to(".dc-hour", { rotation: 180 + 16 * 30, duration: 16 }, 0)
          .to(".dc-min", { rotation: 16 * 360, duration: 16 }, 0)
          .to(".dc-stage", { backgroundColor: "#ff8a4c", duration: 5 }, 3)
          .to(".dc-stage", { backgroundColor: "#12301f", color: "#f5f7ea", duration: 4 }, 11)
          .to(".dc-sun", { yPercent: 260, rotation: 120, duration: 6 }, 9)
          .fromTo(".dc-moon", { yPercent: 240, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 4 }, 12)
          .fromTo(".dc-star", { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, stagger: 0.25, duration: 0.6, ease: "back.out(3)" }, 13);
        gsap.utils.toArray<HTMLElement>(".dc-block").forEach((el, i) => {
          const at = (BLOCKS[i]?.h ?? 6) - 6;
          tl.from(el, { x: 120, rotation: 8, opacity: 0, duration: 0.9, ease: "back.out(1.6)" }, at - 0.9);
          const next = BLOCKS[i + 1]?.h ?? 22.5;
          tl.fromTo(el.querySelector(".dc-strike"), { scaleX: 0 }, { scaleX: 1, duration: 0.6 }, next - 6 - 0.8);
        });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} aria-labelledby="dayclock-title" className="relative h-[340vh] motion-reduce:h-auto">
      <div className="dc-stage sticky top-0 flex min-h-screen items-center overflow-hidden border-y-2 border-ink bg-sticky-yellow text-ink motion-reduce:static">
        <div aria-hidden className="dc-sun absolute top-[8%] right-[6%] size-28 rounded-full border-2 border-ink bg-tomato sm:size-36" />
        <svg aria-hidden className="dc-moon absolute top-[9%] right-[8%] size-24 opacity-0 sm:size-32 motion-reduce:hidden" viewBox="0 0 100 100">
          <path d="M70 12a40 40 0 1 0 18 66A34 34 0 0 1 70 12z" fill="#ffc83d" stroke="#1d1a16" strokeWidth="3" />
        </svg>
        {[
          [14, 22],
          [30, 12],
          [48, 30],
          [64, 8],
          [80, 40],
        ].map(([l, t], i) => (
          <span key={i} aria-hidden className="dc-star absolute text-[22px] text-sticky-yellow opacity-0 motion-reduce:hidden" style={{ left: `${l}%`, top: `${t}%` }}>
            ✦
          </span>
        ))}
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_1fr]">
          <div>
            <Shuffle text="scroll the day →" tag="p" className="font-hand text-[26px] font-bold" textAlign="left" shuffleDirection="up" duration={0.45} shuffleTimes={2} triggerOnHover />
            <SplitHeading id="dayclock-title" className="mt-1 font-[family-name:var(--font-display)] text-[44px] leading-[0.95] font-black tracking-[-0.04em] sm:text-[64px]">
              One day, <em>hour by hour</em>
            </SplitHeading>
            <div className="mt-6 flex items-center gap-6">
              <svg aria-hidden viewBox="0 0 400 400" className="size-44 shrink-0 sm:size-56">
                <circle cx="200" cy="200" r="180" fill="#f5f7ea" stroke="currentColor" strokeWidth="10" />
                {Array.from({ length: 12 }, (_, i) => (
                  <line key={i} x1="200" y1="34" x2="200" y2={i % 3 === 0 ? 70 : 54} stroke="#1d1a16" strokeWidth={i % 3 === 0 ? 10 : 5} strokeLinecap="round" transform={`rotate(${i * 30} 200 200)`} />
                ))}
                <line className="dc-hour" x1="200" y1="200" x2="200" y2="110" stroke="#1d1a16" strokeWidth="16" strokeLinecap="round" transform="rotate(180 200 200)" />
                <line className="dc-min" x1="200" y1="200" x2="200" y2="62" stroke="#ff5a36" strokeWidth="9" strokeLinecap="round" />
                <circle cx="200" cy="200" r="14" fill="#1d1a16" />
              </svg>
              <p>
                <span ref={timeRef} className="block font-[family-name:var(--font-display)] text-[60px] leading-none font-black tabular-nums sm:text-[84px]">
                  06:00
                </span>
                <span className="font-hand text-[22px] font-bold">an example day, not your data</span>
              </p>
            </div>
          </div>
          <ol className="grid gap-3">
            {BLOCKS.map((b) => (
              <li key={b.h} className={`dc-block relative flex items-center gap-4 rounded-2xl border-2 border-ink ${b.tone} px-5 py-4 text-ink shadow-[5px_5px_0_0_#1d1a16]`}>
                <span className="font-mono text-[15px] font-bold">{pad(b.h)}:00</span>
                <span className="relative text-[20px] font-bold">
                  {b.label}
                  <span aria-hidden className="dc-strike absolute top-1/2 left-0 h-[3px] w-full origin-left scale-x-0 rounded-full bg-ink" />
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Habit garden: each day's check-in draws a stem, unfurls leaves and  */
/* pops a flower, scrubbed by scroll.                                   */
/* ------------------------------------------------------------------ */

const PLANTS = [
  { day: "Mon", x: 80, h: 150, c: "#ff5a36" },
  { day: "Tue", x: 195, h: 205, c: "#ffc83d" },
  { day: "Wed", x: 310, h: 120, c: "#ff8fa3" },
  { day: "Thu", x: 425, h: 230, c: "#ff8a4c" },
  { day: "Fri", x: 540, h: 175, c: "#c4e06b" },
  { day: "Sat", x: 655, h: 215, c: "#ff5a36" },
  { day: "Sun", x: 770, h: 160, c: "#ffc83d" },
];
const GROUND = 300;

export function HabitGarden() {
  const root = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      gsap.matchMedia().add(MOTION_OK, () => {
        const tl = gsap.timeline({ scrollTrigger: { trigger: ".hg-svg", start: "top 80%", end: "bottom 45%", scrub: 1 } });
        tl.from(".hg-ground", { drawSVG: "50% 50%", duration: 1 })
          .from(".hg-stem", { drawSVG: "0%", stagger: 0.35, duration: 1.2 }, 0.4)
          .from(".hg-leaf", { scale: 0, transformOrigin: "0% 100%", stagger: 0.12, duration: 0.6, ease: "back.out(2)" }, 0.9)
          .from(".hg-flower", { scale: 0, rotation: -120, transformOrigin: "50% 50%", stagger: 0.35, duration: 0.8, ease: "back.out(2.4)" }, 1.4)
          .from(".hg-day", { y: 20, opacity: 0, stagger: 0.2, duration: 0.5 }, 0.6)
          .from(".hg-streak", { scale: 0, rotation: -20, transformOrigin: "50% 50%", duration: 0.6, ease: "back.out(3)" }, ">-0.2");
        gsap.to(".hg-flower", { rotation: "+=10", yoyo: true, repeat: -1, duration: 1.8, ease: "sine.inOut", stagger: 0.2, transformOrigin: "50% 100%" });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} aria-labelledby="garden-title" className="relative mx-auto max-w-6xl px-5 py-24 sm:px-8">
      <div className="max-w-2xl">
        <Shuffle text="habits that grow" tag="p" className="font-hand text-[26px] font-bold text-hot" textAlign="left" shuffleDirection="up" duration={0.45} shuffleTimes={2} triggerOnHover />
        <SplitHeading id="garden-title" className="mt-1 font-[family-name:var(--font-display)] text-[44px] leading-[0.95] font-black tracking-[-0.04em] text-ink sm:text-[60px]">
          Check in, watch it bloom
        </SplitHeading>
        <p className="mt-4 text-[17px] leading-relaxed text-ink-2">Every habit you tick grows the garden a little more. Miss a day and nothing dies — it just waits for you.</p>
      </div>
      <div className="relative mt-10 rounded-3xl border-2 border-ink bg-panel p-4 shadow-[8px_8px_0_0_#1d1a16] sm:p-8">
        <svg viewBox="0 0 860 360" className="hg-svg w-full" role="img" aria-label="Example week: seven flowers, one for each day a habit was checked in.">
          <line className="hg-ground" x1="20" y1={GROUND} x2="840" y2={GROUND} stroke="#1d1a16" strokeWidth="5" strokeLinecap="round" />
          {PLANTS.map((p, i) => {
            const top = GROUND - p.h;
            return (
              <g key={p.day}>
                <path className="hg-stem" d={`M${p.x} ${GROUND} C${p.x - 16} ${GROUND - p.h * 0.4} ${p.x + 18} ${GROUND - p.h * 0.7} ${p.x} ${top}`} fill="none" stroke="#1d1a16" strokeWidth="5" strokeLinecap="round" />
                <path className="hg-leaf" d={`M${p.x} ${GROUND - p.h * 0.35} q${i % 2 ? -34 : 34} -10 ${i % 2 ? -44 : 44} -34 q${i % 2 ? 22 : -22} 0 ${i % 2 ? 44 : -44} 34z`} fill="#7fd8a4" stroke="#1d1a16" strokeWidth="2.5" strokeLinejoin="round" />
                <path className="hg-leaf" d={`M${p.x + 2} ${GROUND - p.h * 0.62} q${i % 2 ? 30 : -30} -8 ${i % 2 ? 38 : -38} -28 q${i % 2 ? -20 : 20} 0 ${i % 2 ? -38 : 38} 28z`} fill="#c4e06b" stroke="#1d1a16" strokeWidth="2.5" strokeLinejoin="round" />
                <g className="hg-flower">
                  {Array.from({ length: 6 }, (_, k) => (
                    <ellipse key={k} cx={p.x} cy={top - 18} rx="11" ry="20" fill={p.c} stroke="#1d1a16" strokeWidth="2.5" transform={`rotate(${k * 60} ${p.x} ${top})`} />
                  ))}
                  <circle cx={p.x} cy={top} r="11" fill="#1d1a16" />
                  <circle cx={p.x - 3} cy={top - 3} r="3" fill="#f5f7ea" />
                </g>
                <text className="hg-day" x={p.x} y={GROUND + 38} textAnchor="middle" fontSize="20" fontWeight="700" fill="#1d1a16" fontFamily="var(--font-bricolage)">
                  {p.day}
                </text>
              </g>
            );
          })}
          <g className="hg-streak">
            <rect x="660" y="14" width="180" height="48" rx="24" fill="#ffc83d" stroke="#1d1a16" strokeWidth="3" />
            <text x="750" y="46" textAnchor="middle" fontSize="22" fontWeight="800" fill="#1d1a16" fontFamily="var(--font-bricolage)">
              7-day streak
            </text>
          </g>
        </svg>
        <p className="font-hand mt-2 text-right text-[20px] font-bold text-ink-2">an example week</p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Sticker desk: fling notes around with inertia, add your own, then   */
/* shuffle or tidy. A toy — nothing here is saved.                      */
/* ------------------------------------------------------------------ */

type NoteData = { id: number; text: string; tone: string; x: number; y: number; r: number; fresh?: boolean };
const TONES = ["bg-sticky-yellow", "bg-sticky-pink", "bg-sticky-green", "bg-sticky-orange", "bg-sticky-lime", "bg-tomato"];
const START: NoteData[] = [
  { id: 1, text: "Run 5k", tone: "bg-sticky-green", x: 6, y: 10, r: -6 },
  { id: 2, text: "Call grandma", tone: "bg-sticky-pink", x: 30, y: 6, r: 4 },
  { id: 3, text: "Ship the thing", tone: "bg-sticky-yellow", x: 56, y: 14, r: -3 },
  { id: 4, text: "Read 20 pages", tone: "bg-sticky-orange", x: 78, y: 8, r: 7 },
  { id: 5, text: "Drink water", tone: "bg-sticky-lime", x: 12, y: 56, r: 5 },
  { id: 6, text: "Plan Sunday", tone: "bg-tomato", x: 40, y: 52, r: -8 },
  { id: 7, text: "Stretch", tone: "bg-sticky-yellow", x: 66, y: 58, r: 3 },
];

function Note({ n, area, bump }: { n: NoteData; area: React.RefObject<HTMLDivElement | null>; bump: () => number }) {
  // Outer div drops in; inner div is the Draggable. Draggable stalls other tweens on its own target, so they stay separate.
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<HTMLDivElement>(null);
  useGSAP(
    (_ctx, contextSafe) => {
      const el = drag.current!;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      gsap.set(el, { rotation: n.r });
      // Starting notes drop in from StickerDesk on scroll; added ones drop right away.
      if (!reduce && n.fresh) gsap.from(ref.current, { y: -260, scale: 0.3, rotation: gsap.utils.random(-120, 120), duration: 0.9, ease: "back.out(1.5)" });
      const press = contextSafe!(() => {
        ref.current!.style.zIndex = String(bump());
        gsap.to(el, { scale: 1.1, boxShadow: "12px 12px 0 0 #1d1a16", duration: 0.2 });
      });
      const release = contextSafe!(() => {
        gsap.to(el, { scale: 1, boxShadow: "4px 4px 0 0 #1d1a16", rotation: gsap.utils.random(-10, 10), duration: 0.5, ease: "back.out(2.5)" });
      });
      Draggable.create(el, { bounds: area.current, inertia: !reduce, edgeResistance: 0.7, onPress: press, onRelease: release });
    },
    { scope: ref },
  );
  return (
    <div ref={ref} className="sd-note absolute" style={{ left: `${n.x}%`, top: `${n.y}%` }}>
    <div
      ref={drag}
      className={`sd-drag relative w-[132px] cursor-grab touch-none rounded-lg border-2 border-ink ${n.tone} px-3 py-4 text-center text-[17px] leading-tight font-bold text-ink shadow-[4px_4px_0_0_#1d1a16] select-none active:cursor-grabbing sm:w-[150px]`}
    >
      <span aria-hidden className="absolute -top-2 left-1/2 h-4 w-12 -translate-x-1/2 -rotate-3 bg-panel/70" />
      {n.text}
    </div>
    </div>
  );
}

export function StickerDesk() {
  const root = useRef<HTMLElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const zTop = useRef(10);
  const nextId = useRef(100);
  const [notes, setNotes] = useState<NoteData[]>(START);
  const [draft, setDraft] = useState("");
  const bump = () => ++zTop.current;
  const { contextSafe } = useGSAP(
    () => {
      gsap.matchMedia().add(MOTION_OK, () => {
        gsap.from(".sd-note", {
          y: -260,
          scale: 0.3,
          rotation: "random(-120, 120)",
          duration: 0.9,
          ease: "back.out(1.5)",
          stagger: { each: 0.07, from: "random" },
          scrollTrigger: { trigger: area.current, start: "top 75%", once: true },
        });
      });
    },
    { scope: root },
  );

  // fn gets the note wrapper (for its resting offset) and returns vars for the draggable inside it.
  const each = (fn: (el: HTMLElement, i: number, box: DOMRect) => gsap.TweenVars) => {
    const box = area.current!.getBoundingClientRect();
    gsap.utils.toArray<HTMLElement>(".sd-note", area.current).forEach((el, i) => {
      const d = el.firstElementChild as HTMLElement;
      gsap.to(d, { ...fn(el, i, box), onUpdate: () => Draggable.get(d)?.update() });
    });
  };
  // contextSafe is applied at click time so tweens join the scope without touching refs during render.
  const shuffle = () =>
    contextSafe(() =>
    each((el, i, box) => ({
      x: gsap.utils.random(-el.offsetLeft, box.width - el.offsetWidth - el.offsetLeft),
      y: gsap.utils.random(-el.offsetTop, box.height - el.offsetHeight - el.offsetTop),
      rotation: gsap.utils.random(-25, 25),
      duration: 0.9,
      ease: "elastic.out(1, 0.6)",
      delay: i * 0.03,
    })),
  )();
  const tidy = () =>
    contextSafe(() =>
    each((el, i, box) => {
      const cols = Math.max(1, Math.floor(box.width / (el.offsetWidth + 16)));
      return {
        x: 16 + (i % cols) * (el.offsetWidth + 16) - el.offsetLeft,
        y: 16 + Math.floor(i / cols) * (el.offsetHeight + 16) - el.offsetTop,
        rotation: 0,
        duration: 0.7,
        ease: "power3.inOut",
        delay: i * 0.04,
      };
    }),
  )();

  const add = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || notes.length >= 14) return;
    const id = nextId.current++;
    setNotes((ns) => [...ns, { id, text, tone: TONES[id % TONES.length] ?? "bg-sticky-yellow", x: gsap.utils.random(5, 70), y: gsap.utils.random(8, 60), r: gsap.utils.random(-8, 8), fresh: true }]);
    setDraft("");
  };

  return (
    <section ref={root} aria-labelledby="desk-title" className="relative mx-auto max-w-6xl px-5 py-24 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-xl">
          <Shuffle text="go on, throw them" tag="p" className="font-hand text-[26px] font-bold text-hot" textAlign="left" shuffleDirection="up" duration={0.45} shuffleTimes={2} triggerOnHover />
          <SplitHeading id="desk-title" className="mt-1 font-[family-name:var(--font-display)] text-[44px] leading-[0.95] font-black tracking-[-0.04em] text-ink sm:text-[60px]">
            A messy desk is allowed
          </SplitHeading>
          <p className="mt-4 text-[17px] text-ink-2">Drag and fling the notes. Add your own, shuffle the pile, or tidy it into rows.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={shuffle} className="h-11 rounded-xl border-2 border-ink bg-sticky-pink px-4 text-[15px] font-bold text-ink shadow-[3px_3px_0_0_#1d1a16] transition-transform hover:-translate-y-0.5 active:translate-y-0">
            Shuffle
          </button>
          <button type="button" onClick={tidy} className="h-11 rounded-xl border-2 border-ink bg-sticky-lime px-4 text-[15px] font-bold text-ink shadow-[3px_3px_0_0_#1d1a16] transition-transform hover:-translate-y-0.5 active:translate-y-0">
            Tidy up
          </button>
        </div>
      </div>
      <form onSubmit={add} className="mt-6 flex max-w-md gap-2">
        <label htmlFor="desk-note" className="sr-only">
          New note text
        </label>
        <input
          id="desk-note"
          value={draft}
          maxLength={24}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={notes.length >= 14 ? "Desk is full" : "Write a note…"}
          disabled={notes.length >= 14}
          className="h-11 flex-1 rounded-xl border-2 border-ink bg-panel px-3 text-[15px] text-ink placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tomato"
        />
        <button type="submit" disabled={!draft.trim() || notes.length >= 14} className="h-11 rounded-xl border-2 border-ink bg-ink px-4 text-[15px] font-bold text-canvas shadow-[3px_3px_0_0_#ff5a36] disabled:opacity-50">
          Stick it
        </button>
      </form>
      <div ref={area} className="dot-grid relative mt-6 h-[460px] overflow-hidden rounded-3xl border-2 border-ink bg-raised shadow-[8px_8px_0_0_#1d1a16]">
        <p className="font-hand pointer-events-none absolute right-5 bottom-3 text-[20px] font-bold text-ink-2">a toy desk — notes here aren&apos;t saved</p>
        {notes.map((n) => (
          <Note key={n.id} n={n} area={area} bump={bump} />
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Footer marquee: loops forever, speeds up with scroll velocity and   */
/* flips direction when you scroll back up.                             */
/* ------------------------------------------------------------------ */

const LOOP_WORDS = ["Plan", "Bloom", "Focus", "Repeat", "Grow", "Rest"];

export function LoopMarquee() {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      gsap.matchMedia().add(MOTION_OK, () => {
        // Reversed playback would stop at time 0, so start far into the loop and jump ahead whenever it gets back there.
        const loop = gsap.fromTo(
          ".lm-track",
          { x: 0, xPercent: 0 },
          {
            xPercent: -50,
            duration: 22,
            ease: "none",
            repeat: -1,
            onReverseComplete: () => {
              loop.totalTime(loop.rawTime() + loop.duration() * 20);
            },
          },
        );
        loop.totalTime(loop.duration() * 20);
        let dir = 1;
        ScrollTrigger.create({
          trigger: root.current,
          start: "top bottom",
          end: "bottom top",
          onUpdate: (self) => {
            if (self.direction !== dir) dir = self.direction;
            const boost = Math.min(4, 1 + Math.abs(self.getVelocity()) / 600);
            gsap.to(loop, { timeScale: dir * boost, duration: 0.25, overwrite: true });
            gsap.to(loop, { timeScale: dir, duration: 1.2, delay: 0.25, ease: "power2.out" });
          },
        });
        gsap.to(".lm-star", { rotation: 360, duration: 6, ease: "none", repeat: -1 });
      });
    },
    { scope: root },
  );
  return (
    <div ref={root} aria-hidden className="overflow-hidden border-y-2 border-ink bg-tomato py-5 text-ink">
      <div className="lm-track flex w-max items-center gap-8 pr-8 font-[family-name:var(--font-display)] text-[64px] leading-none font-black tracking-[-0.04em] italic sm:text-[96px]">
        {[0, 1].flatMap((copy) =>
          LOOP_WORDS.flatMap((w, i) => [
            <span key={`${copy}-${w}`} className={i % 2 ? "text-outline" : undefined}>
              {w}
            </span>,
            <span key={`${copy}-${w}-s`} className="lm-star inline-block text-sticky-yellow">
              ✦
            </span>,
          ]),
        )}
      </div>
    </div>
  );
}
