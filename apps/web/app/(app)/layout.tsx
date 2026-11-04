import { AppShell } from "@/components/shell";

/** The planner: every app route shares the shell (sidebar, quick capture, focus engine). */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
