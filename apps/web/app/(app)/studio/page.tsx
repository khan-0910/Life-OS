import type { Metadata } from "next";
import { Suspense } from "react";
import { StudioRoute } from "@/components/views/studio";

export const metadata: Metadata = { title: "Goal Studio" };

export default function Page() {
  return (
    <Suspense>
      <StudioRoute />
    </Suspense>
  );
}
