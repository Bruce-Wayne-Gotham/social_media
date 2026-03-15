"use client";

import { useState } from "react";
import { apiRequest } from "@/src/lib/api";

const platforms = [
  { id: "linkedin", label: "LinkedIn" },
  { id: "instagram", label: "Instagram" },
  { id: "youtube", label: "YouTube" }
];

export function ConnectAccounts({ accounts = [], clientId = "", onRefresh }) {
  const [busyPlatform, setBusyPlatform] = useState("");
  const [error, setError] = useState("");

  async function handleConnect(platform) {
    setBusyPlatform(platform);
    setError("");

    try {
      const authUrlPath = platformStartPath(platform);
      const { authUrl } = await apiRequest(authUrlPath);
      window.location.assign(authUrl);
    } catch (connectError) {
      setError(connectError.message);
      setBusyPlatform("");
    }
  }

  async function handleDisconnect(socialProfileId) {
    setError("");
    try {
      await apiRequest(`/social-profiles/${socialProfileId}`, { method: "DELETE" });
      await onRefresh?.();
    } catch (disconnectError) {
      setError(disconnectError.message);
    }
  }

  function platformStartPath(platform) {
    if (clientId) {
      return `/clients/${clientId}/social-profiles/oauth/${platform}/start`;
    }
    return `/social-accounts/oauth/${platform}/start`;
  }

  return (
    <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6">
      <div className="mb-4">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Connections</p>
        <h2 className="mt-2 text-2xl">Social Accounts</h2>
      </div>
      <div className="space-y-3">
        {platforms.map((platform) => {
          const connected = accounts.filter((account) => account.platform === platform.id);
          return (
            <div
              className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-white/60 p-4"
              key={platform.id}
            >
              <div>
                <p className="font-semibold">{platform.label}</p>
                <p className="text-sm text-[var(--muted)]">
                  {connected.length
                    ? `Connected (${connected.length})`
                    : "Not connected"}
                </p>
                {connected.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {connected.map((profile) => (
                      <span
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/70 px-3 py-1 text-xs"
                        key={profile.id}
                      >
                        {profile.account_name || profile.provider_account_id || "profile"}
                        <button
                          className="underline"
                          type="button"
                          onClick={() => handleDisconnect(profile.id)}
                        >
                          Disconnect
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <button
                className="rounded-full border border-[var(--line)] px-4 py-2 text-sm"
                type="button"
                onClick={() => handleConnect(platform.id)}
                disabled={busyPlatform === platform.id}
              >
                {busyPlatform === platform.id ? "Redirecting..." : connected.length ? "Connect another" : "Connect"}
              </button>
            </div>
          );
        })}
      </div>
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
