"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/src/lib/api";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const response = await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify(form)
      });

      localStorage.setItem("socialhub_token", response.token);
      router.push("/dashboard");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-8 shadow-[0_25px_80px_rgba(30,20,10,0.08)] backdrop-blur">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">SocialHub</p>
        <h1 className="mt-3 text-4xl leading-tight">Write once. Publish everywhere.</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Sign in to connect accounts, schedule posts, and manage cross-platform publishing.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <input
          className="w-full rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 outline-none"
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          required
        />
        <input
          className="w-full rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 outline-none"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          required
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          className="w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-white transition hover:bg-[var(--accent-dark)] disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          {submitting ? "Submitting..." : mode === "login" ? "Login" : "Create account"}
        </button>
      </form>

      <button
        className="mt-4 text-sm text-[var(--muted)] underline"
        type="button"
        onClick={() => setMode(mode === "login" ? "register" : "login")}
      >
        {mode === "login" ? "Need an account? Register" : "Already have an account? Login"}
      </button>
    </div>
  );
}
