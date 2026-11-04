import type { Metadata } from "next";
import { PlanView } from "@/components/views/plan";

export const metadata: Metadata = { title: "Plan" };

export default function Page() {
  return <PlanView />;
}
