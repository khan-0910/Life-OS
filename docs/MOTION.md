# Visual & motion system — "a living daybook"

LifeOS is bright, pastel and richly animated by default, with a complete reduced-motion mode. Motion always reflects real state; it never decides anything.

## Rules that never bend

- **State first, motion second.** Completing, saving, starting/stopping focus, emergency stop, import/delete happen on click. Effects play afterwards and never call back into app logic (`lib/fx.ts` has no return path).
- **Truthful.** Rings, bars, counts and trails animate from the old real value to the new one. No count-ups, fake progress or random movement. Landing illustrations are labeled "example" or "Illustration".
- **Reduced motion is complete.** `MotionConfig reducedMotion="user"` (app and landing), CSS `prefers-reduced-motion` rules, and `prefersReducedMotion()` / `useCalm()` checks. Loops, parallax, curtains, trails, blooms, holds and tilts are removed; content and controls are all still there.
- **Never block input.** All effect layers are `pointer-events: none`; focus stays where it was (Pause/Resume swap a label inside one button; the Focus run panel mounts immediately so Emergency stop is always available).

## Palette (`app/globals.css`)

Warm cream surfaces (`canvas #fdf7ef`, `panel #fffdf9`), deep plum ink (`ink #2a2036`, `ink-2`, `ink-3`, all ≥ 4.5:1). Pastel fills: `mint`, `butter`, `peach`, `blush`, `lavender`, `powder`, `cream`. The accent names `sage / amber / rose / sky / violet` are now deep, text-safe tones (≥ 4.5:1 on canvas) so existing components keep their meaning. Time blocks are pastel with deep ink text (`components/block-style.ts`).

## Signature motif: the Dayline

A pastel ribbon (peach → blush → lavender → sky → mint) with a bright white "now" head:

| Where | What it does |
| --- | --- |
| Landing hero preview | Draws itself across the example Today card; the head pops in. |
| Enter curtain | A Dayline wave draws across the screen while the planner opens. |
| Today | Progress through the day, blocks as ticks; draws in on arrival. |
| Planner | The current-time rule; its head breathes slowly. |
| Focus | Gradient ring (lavender→sky, peach→butter on break) with the head on the leading edge and an orbiting dotted ring. |
| Buttons/skeletons | `dayline-shimmer` underline on the primary CTA and loading skeletons. |

## Layers

| Layer | File | Notes |
| --- | --- | --- |
| Ambient field | `components/ambient.tsx` | Four radial-gradient blobs drifting 38–54 s (transform only, no blur filter). Mood follows activity: `day`, `focus` (cool), `break` (warm), `landing`. |
| FX layer | `components/fx-layer.tsx`, `lib/fx.ts` | Root-level, survives navigation: enter curtain (clip-path circle from the CTA), completion trails (comet dots arcing to `[data-fx-target]` rings), focus threshold bloom. |
| Hidden-tab pause | FX layer sets `html[data-hidden]` | Pauses every CSS loop when the tab is hidden. |

## Landing (`/`, `components/landing/*`)

- **Hero:** kinetic headline (words rise and rotate in), a rotating phrase (pauses when hidden, static under reduced motion), staggered CTA/trust row, floating shapes with scroll parallax, and an interactive preview built from LifeOS UI pieces. Five cards arrive on different spatial paths, float, and tilt with the pointer on fine-pointer devices.
- **Story:** six chapters, each with its own choreography — scroll-scrubbed schedule blocks, a habit field blooming outward from the center with a growing streak path, task chips drawing connectors into a goal ring, a clip-path "threshold" reveal into the Focus band, bars springing up with a drawn trend line, privacy cards flipping in — then a final CTA band.
- **Entry:** `EnterLink` is a real `<Link href="/today">`. A plain click also plays the curtain while Next navigates; nothing waits on it. First visit → existing first-run choice (blank or labeled sample). Returning browsers see "Open my planner"; they are never forced through setup. Direct links, refresh and back/forward work without the curtain.

## Planner

- **Arrival:** sidebar springs in; Today's focal hierarchy staggers in once per page load; the Dayline draws.
- **Navigation:** the template slides pages from the right when moving down the nav and from the left when moving up; the nav pill (desktop and mobile) travels between items and the active icon wiggles once.
- **Controls:** buttons press (3%), Segmented controls have a traveling pill, switches spring, page titles rise letter by letter, cards lift with a light sheen on hover/focus, empty states float, toasts spring in.
- **Today completion:** the check draws, pops and blooms (ring + 6 petals); the row holds checked with a mint wash for 650 ms, then slides away; a pastel comet arcs from the check to the Tasks ring, which bumps while its number rolls; the next action crossfades. Undo releases the hold. Habit checks on Today trail to the Habits ring.
- **Plan:** prev/next slides the grid in the direction of travel; the drag ghost springs between 15-minute slots and turns amber with "Overlaps N"; a drop settles with a ring and a light trace sweep; new blocks grow in, deleted ones fade.
- **Habits/goals:** history cells pop as they fill; streak/rate figures roll; goal rings and project bars use gradients and spring to new real values; progress bars carry a slow glint.
- **Focus:** start triggers the threshold bloom and the ambient field cools to lavender; the run panel scales in; the planner recedes (dimmed and desaturated, still usable); pause desaturates the ring; break warms the ring, glow and ambient field.
- **Insights:** bars spring up on load and range change; a trend line draws through the real daily values afterwards; summary figures roll.

## Performance

- Frequent motion uses transforms/opacity. Blurs are limited to small static surfaces (`glass`), not animated.
- Drag previews re-render only when the snapped slot changes.
- Pointer tilt uses motion values (no React state per frame) and is disabled on coarse pointers.
- CSS loops pause when the tab is hidden and are removed under reduced motion.
- No canvas/WebGL/video; no new dependencies (Motion 14.9 only).

## Board layer (goal-setting canvas)

- **Palette:** saturated sticky-note fills (`sticky-yellow/pink/blue/green/orange/violet`), a `night` ink for high-contrast bands, and an `electric → hot` gradient for primary buttons (white text ≥ 4.5:1).
- **Landing:** scroll progress ribbon, pointer glow (fine pointers only), a velocity-skewed template marquee, a 3D-tilting dotted whiteboard with draggable sticky notes whose connectors follow them live and two "example" cursors, and a night band revealed by a growing clip-path circle with animated template previews (mandala bloom, morphing wheel, OKR bars, flipping SMART letters, drawn roadmap).
- **Goal Studio (`/studio`):** template tiles morph into their editor (`layoutId`); each canvas mirrors the user's input (SMART letters flip as fields fill, the wheel polygon springs to ratings, mandala cells fly in from the center, the roadmap path redraws). Creating writes real goals/projects/tasks first, then plays a sticky-note confetti burst (`fxBurst`).
- Reduced motion: no drag tilt, cursors, glow, marquee or aurora loops; everything is shown in its final state.

## Risograph pass (current look)

- **Palette:** uncoated paper (`#f4efe6`), warm ink (`#1d1a16`), tomato, sun yellow, true blue, mint and coral. No purple, no glassmorphism, no gradient text: solid fills, 2–3px ink borders and hard offset shadows. A static paper-grain overlay sits above everything (pointer-events off).
- **Type:** Fraunces (variable, `SOFT`/`WONK` axes on) for display, Bricolage Grotesque for UI, Caveat for handwritten notes. Self-hosted by `next/font`.
- **New landing motion (`components/landing/extras.tsx`):** hero letters hop on hover and the accent line rolls a variable-weight wave; a hand-drawn scribble draws under "bloom."; the tagline rolls like a drum; a circular badge spins faster with scroll speed; the CTA is magnetic; a scroll-scrubbed manifesto fades words in and spins stickers into place; a pinned horizontal track rolls six feature cards; an odometer rolls example numbers; a giant "LifeOS" wordmark rolls up letter by letter.
- Reduced motion: no waves, hops, spin, pinning or magnet; the track becomes a plain grid.

## GSAP scenes (matcha pass)

Page background is now matcha milk (`--color-canvas: #e2e8cf`); deep accents were darkened to stay ≥ 4.5:1 on it.
`components/landing/gsap-scenes.tsx` uses GSAP 3.15 + `@gsap/react` (plugins registered once in `components/landing/gsap.ts`):

- `SplitHeading` — SplitText chars spring out of word masks on scroll.
- `DayClock` — sticky 340vh section; scroll scrubs clock hands 06:00→22:00, sunrise → sunset → night colors, example time blocks arrive and get struck through.
- `HabitGarden` — DrawSVG stems, leaves and flowers grow with scroll (example week).
- `StickerDesk` — Draggable + Inertia notes: fling, add your own, Shuffle, Tidy up. Not saved.
  Draggable stalls other tweens on its own target, so each note has an outer div (drop-in) and an inner div (drag).

All animation runs inside `useGSAP` with `gsap.matchMedia("(prefers-reduced-motion: no-preference)")`; with reduced motion the sections render static (dragging still works, without inertia).

## Final polish pass

- No blues or purples anywhere: blue/purple fills → apricot/oat/cream, cobalt link/focus accent → jade (#0f6b5c), "sky" accent → raspberry. Habit color swatches are labeled Green / Ochre / Jade / Raspberry.
- Leftover pastel gradients (rollover panel, focus buttons, progress bars, toggle, dialog, landing focus band) now use the ink-border + offset-shadow style.
- Headings: page titles, the Today date, dialog and settings section titles use Fraunces black; small section labels stay uppercase Bricolage.
- Page titles hop letter by letter on hover and draw a tomato scribble underline.
- Landing: Lenis smooth scrolling (synced to GSAP's ticker; off under reduced motion) and a footer `LoopMarquee` that speeds up with scroll velocity and reverses on scroll-up.
- Fixed: motion springs given 3 keyframes (settings toggle, studio SMART letters) threw at runtime; marquee stalled when played in reverse.
