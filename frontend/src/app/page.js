import { AuthForm } from "@/src/components/AuthForm";
import { ProductTourPanel } from "@/src/components/ProductTourPanel";

export default function HomePage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-7xl items-center gap-8 px-6 py-12 lg:grid-cols-[1.15fr_0.85fr]">
      <ProductTourPanel />
      <AuthForm />
    </main>
  );
}
