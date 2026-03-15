import { DashboardShell } from "@/src/components/DashboardShell";
import { Suspense } from "react";

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
      <DashboardShell />
    </Suspense>
  );
}

