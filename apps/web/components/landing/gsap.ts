"use client";

import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Draggable } from "gsap/Draggable";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { InertiaPlugin } from "gsap/InertiaPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

// Registered once on the client; nothing GSAP runs during SSR (all calls live inside useGSAP).
if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, DrawSVGPlugin, Draggable, InertiaPlugin);
}

export const MOTION_OK = "(prefers-reduced-motion: no-preference)";
export { gsap, useGSAP, Draggable, ScrollTrigger, SplitText };
