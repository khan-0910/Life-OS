import type { Metadata } from "next";
import { Suspense } from "react";
import { FocusView } from "@/components/views/focus";

export const metadata: Metadata = { title: "Focus" };

export default function Page() {
  return (
    <Suspense>
      <FocusView />
    </Suspense>
  );
}
