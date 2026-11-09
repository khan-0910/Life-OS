import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Caveat, Fraunces } from "next/font/google";
import { FxLayer } from "@/components/fx-layer";
import ClickSpark from "@/components/bits/ClickSpark";
import "./globals.css";

// next/font downloads these at build time and serves them from this origin:
// no runtime requests to Google. Variable axes let headings animate weight/softness.
const fraunces = Fraunces({ subsets: ["latin"], axes: ["SOFT", "WONK", "opsz"], style: ["normal", "italic"], variable: "--font-fraunces", display: "swap" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], axes: ["opsz", "wdth"], variable: "--font-bricolage", display: "swap" });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat", display: "swap" });

export const metadata: Metadata = {
  title: { default: "LifeOS — a living daybook", template: "%s — LifeOS" },
  description: "Plan your day and week, build habits, move goals forward and focus — privately, in your browser.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#e2e8cf",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${bricolage.variable} ${caveat.variable}`}>
      <body>
        {/* React Bits ClickSpark: a small ink-and-tomato burst at every click (skipped under reduced motion). */}
        <ClickSpark sparkColor={["#ff5a36", "#ffc83d", "#1d1a16"]} sparkSize={10} sparkRadius={22} sparkCount={9} shape="line" duration={420} className="min-h-dvh">
          {children}
        </ClickSpark>
        <FxLayer />
      </body>
    </html>
  );
}
