"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, MotionConfig, motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { HardDrive, Sparkles, WifiOff } from "lucide-react";
import { AmbientField } from "../ambient";
import { EnterLink, useReturning } from "./enter-link";
import { CursorGlow, NightTemplates, ScrollProgress, TemplateMarquee, Whiteboard } from "./board";
import { GiantWordmark, Magnetic, Manifesto, OdometerStrip, PlayLetters, RollingBadge, RollingTrack, Scribble } from "./extras";
import { DayClock, HabitGarden, LoopMarquee, StickerDesk } from "./gsap-scenes";
import { SmoothScroll } from "./smooth-scroll";
import { HeroDots, LoopStack, TodayBoard } from "./bits-scenes";
import { HeroPreview } from "./hero-preview";
import { Story } from "./story";

const EASE = [0.22, 1, 0.36, 1] as const;
const PHRASES = ["Plan the day in time.", "Keep habits blooming.", "Move goals with real work.", "Focus in a quieter room."];

/** Words rise in from a mask; each letter then hops on hover. `wave` rolls a weight wave through the line. */
function KineticLine({ words, delay, className, wave, scribble }: { words: string[]; delay: number; className?: string; wave?: boolean; scribble?: boolean }) {
  return (
    <span className={className}>
      {words.map((w, i) => (
        <span key={i} className="relative inline-block pr-[0.22em] pb-[0.08em] align-bottom [clip-path:inset(-40%_-10%_0_-10%)]">
          <motion.span
            className="relative inline-block"
            initial={{ y: "110%", rotate: 8, opacity: 0 }}
            animate={{ y: "0%", rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 120, damping: 14, delay: delay + i * 0.09 }}
          >
            <PlayLetters text={w} wave={wave} delay={i * 0.4} />
            {scribble && i === words.length - 1 ? <Scribble delay={delay + 0.9} /> : null}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

function RotatingPhrase() {
  const reduce = useReducedMotion() ?? false;
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") setI((n) => (n + 1) % PHRASES.length);
    }, 2800);
    return () => window.clearInterval(id);
  }, [reduce]);
  return (
    <p className="font-hand relative h-11 overflow-hidden text-[30px] leading-[1.3] font-bold text-ink-2 sm:text-[34px]" style={{ perspective: 400 }} aria-live="off">
      <span className="sr-only">{PHRASES.join(" ")}</span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={i}
          aria-hidden
          className="absolute inset-x-0 left-0 inline-block"
          style={{ transformOrigin: "50% 50% -20px" }}
          initial={{ rotateX: -95, y: "40%", opacity: 0 }}
          animate={{ rotateX: 0, y: "0%", opacity: 1 }}
          exit={{ rotateX: 95, y: "-40%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 160, damping: 15 }}
        >
          {PHRASES[i]}
        </motion.span>
      </AnimatePresence>
    </p>
  );
}

export function Landing() {
  const returning = useReturning();
  const { scrollY } = useScroll();
  const navShadow = useTransform(scrollY, [0, 80], ["0 0 0 rgb(0 0 0 / 0)", "0 10px 30px -18px rgb(29 26 22 / 0.45)"]);

  return (
    <MotionConfig reducedMotion="user">
      <SmoothScroll />
      <AmbientField mood="landing" />
      <ScrollProgress />
      <CursorGlow />
      <a href="#main" className="sr-only z-50 rounded-lg bg-ink px-3 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>
      <motion.header className="glass sticky top-0 z-40 border-b-2 border-ink" style={{ boxShadow: navShadow }} initial={{ y: -64 }} animate={{ y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
        <nav aria-label="Primary" className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span aria-hidden className="grid size-8 place-items-center rounded-xl border-2 border-ink bg-sticky-yellow">
              <svg viewBox="0 0 20 20" width="16" height="16">
                <circle cx="10" cy="10" r="7" fill="none" stroke="#1d1a16" strokeWidth="2.2" />
                <path d="M10 3a7 7 0 0 1 7 7h-7z" fill="#1d1a16" />
              </svg>
            </span>
            <span className="font-[family-name:var(--font-display)] text-[19px] font-black tracking-tight">LifeOS</span>
          </Link>
          <ul className="hidden items-center gap-7 text-[14px] font-medium text-ink-2 md:flex">
            {[
              ["#board", "Board"],
              ["#templates", "Templates"],
              ["#plan", "Plan"],
              ["#focus", "Focus"],
              ["#privacy", "Privacy"],
            ].map(([href, label]) => (
              <li key={href}>
                <a href={href} className="relative transition-colors hover:text-ink after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:rounded-full after:bg-violet after:transition-transform after:duration-300 hover:after:scale-x-100">
                  {label}
                </a>
              </li>
            ))}
          </ul>
          <EnterLink className="h-10 rounded-xl px-4 text-[14px]" />
        </nav>
      </motion.header>

      <main id="main">
        <section aria-labelledby="hero-title" className="relative overflow-hidden">
          <HeroDots />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pt-14 pb-20 sm:px-8 md:pt-20 lg:grid-cols-[1.05fr_1fr] lg:pb-28">
            <div>
              <motion.p
                className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-sticky-yellow px-3 py-1 text-[13px] font-semibold text-ink"
                initial={{ opacity: 0, y: 12, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, ease: EASE }}
              >
                <Sparkles size={14} className="text-hot" aria-hidden /> A living daybook for your whole life
              </motion.p>
              <h1 id="hero-title" className="mt-6 font-[family-name:var(--font-display)] text-[56px] leading-[0.95] font-black tracking-[-0.05em] text-ink sm:text-[80px] lg:text-[96px]">
                <KineticLine words={["Your", "days,"]} delay={0.15} className="block" />
                <KineticLine words={["in", "full", "bloom."]} delay={0.4} className="hot-text block" wave scribble />
              </h1>
              <motion.div className="mt-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9, duration: 0.6 }}>
                <RotatingPhrase />
              </motion.div>
              <motion.p className="mt-4 max-w-lg text-[17px] leading-relaxed text-ink-2" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0, duration: 0.6, ease: EASE }}>
                Tasks, time blocks, habits, goals and focus sessions in one bright, private planner. Everything you finish moves your day forward — and you can see it happen.
              </motion.p>
              <motion.div className="mt-8 flex flex-wrap items-center gap-3" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.15, duration: 0.6, ease: EASE }}>
                <Magnetic>
                  <EnterLink />
                </Magnetic>
                <a href="#story" className="inline-flex h-12 items-center rounded-2xl border-2 border-ink bg-panel px-5 text-[15px] font-semibold text-ink shadow-[4px_4px_0_0_#1d1a16] transition-[transform,background-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:bg-sticky-yellow hover:shadow-[6px_6px_0_0_#1d1a16] active:scale-[0.98]">
                  See how it works
                </a>
              </motion.div>
              <motion.p className="mt-4 text-[13px] text-ink-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }}>
                {returning ? "Welcome back — your planner is right where you left it." : "First visit? You'll choose a blank start or a labeled sample plan."}
              </motion.p>
              <motion.ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-medium text-ink-2" initial="off" animate="on" variants={{ on: { transition: { staggerChildren: 0.08, delayChildren: 1.4 } } }}>
                {[
                  [<HardDrive key="a" size={14} />, "Private by default"],
                  [<WifiOff key="b" size={14} />, "Works offline"],
                  [<Sparkles key="c" size={14} />, "No account needed"],
                ].map(([icon, text]) => (
                  <motion.li key={text as string} className="inline-flex items-center gap-1.5" variants={{ off: { opacity: 0, y: 8 }, on: { opacity: 1, y: 0 } }}>
                    <span className="text-hot">{icon}</span> {text}
                  </motion.li>
                ))}
              </motion.ul>
              <TodayBoard />
            </div>
            <div className="relative">
              <RollingBadge className="absolute -top-14 -left-10 z-20 hidden lg:block" />
              <HeroPreview />
            </div>
          </div>
        </section>

        <TemplateMarquee />
        <Manifesto />
        <LoopStack />
        <Whiteboard />
        <RollingTrack />
        <DayClock />
        <NightTemplates />
        <HabitGarden />
        <OdometerStrip />
        <StickerDesk />
        <Story />
        <GiantWordmark />
        <LoopMarquee />
      </main>

      <footer className="py-8 text-center text-[13px] text-ink-3">
        LifeOS · Local mode keeps your data in this browser. <Link href="/settings#data" className="font-semibold text-ink underline decoration-tomato decoration-2 underline-offset-2">Export or delete</Link> any time.
      </footer>
    </MotionConfig>
  );
}
