"use client";

import { useState } from "react";
import { apiRequest } from "@/src/lib/api";

const platforms = [
  { id: "twitter", label: "X / Twitter" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "instagram", label: "Instagram" },
  { id: "youtube", label: "YouTube" }
];

export function ConnectAccounts({ accounts = [] }) {
  const [busyPlatform, setBusyPlatform] = useState("");
  const [error, setError] = useState("");

  async function handleConnect(platform) {
    setBusyPlatform(platform);
    setError("");

    try {
      const { authUrl } = await apiRequest(`/social-accounts/oauth/${platform}/start`);
      window.location.assign(authUrl);
    } catch (connectError) {
      setError(connectError.message);
      setBusyPlatform("");
    }
  }

  return (
    <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6">
      <div className="mb-4">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Connections</p>
        <h2 className="mt-2 text-2xl">Social Accounts</h2>
      </div>
      <div className="space-y-3">
        {platforms.map((platform) => {
          const connected = accounts.find((account) => account.platform === platform.id);
          return (
            <div
              className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-white/60 p-4"
              key={platform.id}
            >
              <div>
                <p className="font-semibold">{platform.label}</p>
                <p className="text-sm text-[var(--muted)]">
                  {connected ? `Connected as ${connected.account_name || "account"}` : "Not connected"}
                </p>
              </div>
              <button
                className="rounded-full border border-[var(--line)] px-4 py-2 text-sm"
                type="button"
                onClick={() => handleConnect(platform.id)}
                disabled={busyPlatform === platform.id}
              >
                {busyPlatform === platform.id ? "Redirecting..." : connected ? "Reconnect" : "Connect"}
              </button>
            </div>
          );
        })}
      </div>
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
