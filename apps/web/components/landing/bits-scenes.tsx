"use client";

import { useRef } from "react";
import { CalendarClock, CheckCircle2, Inbox, Timer } from "lucide-react";
import DotGrid from "../bits/DotGrid";
import ScrollStack, { ScrollStackItem } from "../bits/ScrollStack";
import SplitFlapText from "../bits/SplitFlapText";
import VariableProximity from "../bits/VariableProximity";

/** Springy ink dot field behind the hero: dots swell under the cursor and shock outward on click (no color shift). */
export function HeroDots() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_80%)]">
      <DotGrid dotSize={4} gap={22} baseColor="#1d1a16" activeColor="#1d1a16" proximity={130} opacity={0.22} glow={0.2} shockStrength={4} />
    </div>
  );
}

/** Departure-board for an example day, flipping through upcoming blocks. */
export function TodayBoard() {
  return (
    <div className="mt-8 inline-flex flex-col gap-2 rounded-2xl border-2 border-ink bg-ink p-3 shadow-[6px_6px_0_0_#ff5a36]">
      <p className="flex items-center justify-between gap-6 px-1 font-mono text-[11px] font-bold tracking-[0.2em] text-sticky-yellow">
        <span>Next up</span>
        <span className="text-canvas/60">example board</span>
      </p>
      <SplitFlapText
        words={["07:00 RUN 5K", "09:00 DEEP WORK", "13:00 LUNCH WALK", "17:00 READ", "21:00 WIND DOWN"]}
        padTo={16}
        fontSize="clamp(15px, 2.3vw, 24px)"
        tileColor="#2a2620"
        textColor="#ffc83d"
        tileRadius={4}
        gap={3}
        cycleDelay={2600}
        charset="alphanumeric"
        aria-label="Example schedule: 7:00 run 5k, 9:00 deep work, 13:00 lunch walk, 17:00 read, 21:00 wind down"
      />
    </div>
  );
}

/** Big closing line whose letters thicken and soften as the cursor nears (Fraunces wght + SOFT axes). */
export function ProximityLine({ text, className, toColor }: { text: string; className?: string; toColor?: string }) {
  const box = useRef<HTMLDivElement>(null);
  return (
    <div ref={box} className={className}>
      <VariableProximity
        label={text}
        containerRef={box}
        fromFontVariationSettings="'wght' 560, 'SOFT' 0, 'WONK' 0"
        toFontVariationSettings="'wght' 900, 'SOFT' 100, 'WONK' 1"
        radius={160}
        falloff="gaussian"
        toColor={toColor}
      />
    </div>
  );
}

const STEPS = [
  { n: "01", icon: Inbox, title: "Capture", body: "Press N anywhere. A task lands in Inbox before the thought escapes.", bg: "#ffc83d" },
  { n: "02", icon: CalendarClock, title: "Plan", body: "Drag tasks onto the day. Time blocks stack up into a real schedule.", bg: "#ff8fa3" },
  { n: "03", icon: Timer, title: "Focus", body: "One button starts a session. The planner quiets down until you're done.", bg: "#7fd8a4" },
  { n: "04", icon: CheckCircle2, title: "Review", body: "Close the day: carry over what's left, see what moved forward.", bg: "#ff8a4c" },
];

/** The daily loop as cards that pin and pile up as you scroll (React Bits ScrollStack on window scroll, so Lenis drives it). */
export function LoopStack() {
  return (
    <section aria-labelledby="loop-title" className="relative mx-auto max-w-4xl px-5 pt-24 sm:px-8">
      <p className="font-hand text-[26px] font-bold text-hot">the daily loop</p>
      <h2 id="loop-title" className="mt-1 font-[family-name:var(--font-display)] text-[44px] leading-[0.95] font-black tracking-[-0.04em] text-ink sm:text-[60px]">
        Four moves, every day
      </h2>
      <ScrollStack useWindowScroll smoothScroll={false} itemDistance={120} itemStackDistance={28} stackPosition="18%" baseScale={0.86} itemScale={0.035} rotationAmount={1.5} dimAmount={0.12}>
        {STEPS.map(({ n, icon: Icon, title, body, bg }) => (
          <ScrollStackItem key={n} itemClassName="border-2 border-ink" style={{ background: bg, color: "#1d1a16", boxShadow: "8px 8px 0 0 #1d1a16" }}>
            <div className="flex h-full flex-col justify-between">
              <div className="flex items-start justify-between">
                <span className="font-[family-name:var(--font-display)] text-[72px] leading-none font-black tracking-[-0.05em] sm:text-[96px]">{n}</span>
                <span className="grid size-14 place-items-center rounded-2xl border-2 border-ink bg-panel">
                  <Icon size={26} aria-hidden />
                </span>
              </div>
              <div>
                <h3 className="font-[family-name:var(--font-display)] text-[34px] leading-none font-black italic">{title}</h3>
                <p className="mt-2 max-w-md text-[17px] font-medium">{body}</p>
              </div>
            </div>
          </ScrollStackItem>
        ))}
      </ScrollStack>
    </section>
  );
}
