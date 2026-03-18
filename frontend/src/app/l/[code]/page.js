import { redirect } from "next/navigation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";

export default async function ShortLinkRedirectPage({ params }) {
  const response = await fetch(`${API_BASE_URL}/tracked-links/${params.code}/resolve`, {
    cache: "no-store",
    redirect: "manual"
  });

  if (!response.ok) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-3xl">Tracked link not found</h1>
        <p className="mt-4 text-sm text-[var(--muted)]">This short link is invalid or no longer available.</p>
      </main>
    );
  }

  const payload = await response.json();
  redirect(payload.url);
}
