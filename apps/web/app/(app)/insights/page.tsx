import type { Metadata } from "next";
import { InsightsView } from "@/components/views/insights";

export const metadata: Metadata = { title: "Insights" };

export default function Page() {
  return <InsightsView />;
}
