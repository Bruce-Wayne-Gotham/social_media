import { AuthForm } from "@/src/components/AuthForm";
import { PainPointsPanel } from "@/src/components/PainPointsPanel";

export default function HomePage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-7xl items-center gap-8 px-6 py-12 lg:grid-cols-[1.15fr_0.85fr]">
      <PainPointsPanel />
      <AuthForm />
    </main>
  );
}
