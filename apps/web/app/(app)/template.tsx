"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";

const ORDER = ["/today", "/plan", "/habits", "/goals", "/studio", "/focus", "/insights", "/settings"];
let lastIndex = -1;

/**
 * Re-mounts on every navigation. Moving down the main nav slides the page in
 * from the right, moving up from the left — so sections feel spatially
 * connected. Reduced motion (via the shell's MotionConfig): opacity only.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const index = ORDER.findIndex((p) => pathname.startsWith(p));
  const dir = lastIndex < 0 || index < 0 ? 0 : Math.sign(index - lastIndex);

  useEffect(() => {
    lastIndex = index;
  }, [index]);

  return (
    <motion.div
      initial={{ opacity: 0, x: dir * 44, y: dir === 0 ? 14 : 0, scale: 0.985 }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 240, damping: 28, mass: 0.9 }}
    >
      {children}
    </motion.div>
  );
}
