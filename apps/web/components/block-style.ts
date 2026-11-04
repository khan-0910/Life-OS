import type { BlockKind } from "@lifeos/domain";

/** Pastel fills with deep ink text (contrast ≥ 4.5:1). */
export const BLOCK_STYLE: Record<BlockKind, { bar: string; box: string; label: string; fill: string }> = {
  focus: { bar: "bg-[#f2b75a]", box: "border-[#e8b45c] bg-butter text-[#5a3800]", label: "Focus", fill: "#ffe9a6" },
  meeting: { bar: "bg-[#f2a65a]", box: "border-[#f2a65a] bg-powder text-[#6b2e0a]", label: "Meeting", fill: "#fde2c4" },
  admin: { bar: "bg-[#ff8fa3]", box: "border-[#e6b98a] bg-lavender text-[#5a3800]", label: "Admin", fill: "#efe3cc" },
  personal: { bar: "bg-[#6fd0a2]", box: "border-[#86d6af] bg-mint text-[#11573a]", label: "Personal", fill: "#c8f0dc" },
};
