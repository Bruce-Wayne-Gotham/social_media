"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/src/lib/api";

const platformOptions = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" }
];

function formatBytes(value) {
  if (!value) return "0 B";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function PostComposer({ clientId = "", onCreated }) {
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaAssetId, setMediaAssetId] = useState("");
  const [assets, setAssets] = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hashtags, setHashtags] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [platforms, setPlatforms] = useState(["linkedin"]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function togglePlatform(platform) {
    setPlatforms((current) =>
      current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform]
    );
  }

  async function loadAssets(nextClientId = clientId) {
    if (!nextClientId || nextClientId === "all") {
      setAssets([]);
      return [];
    }

    setAssetsLoading(true);
    try {
      const { assets: nextAssets } = await apiRequest(`/clients/${nextClientId}/media-assets`);
      setAssets(nextAssets);
      return nextAssets;
    } finally {
      setAssetsLoading(false);
    }
  }

  useEffect(() => {
    setMediaAssetId("");
    setMediaUrl("");
    loadAssets(clientId).catch((loadError) => setError(loadError.message || "Failed to load media assets"));
  }, [clientId]);

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");
    try {
      if (!clientId || clientId === "all") {
        throw new Error("Select a client before uploading media.");
      }

      const upload = await apiRequest(`/clients/${clientId}/media-assets/upload-url`, {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          fileSizeBytes: file.size
        })
      });

      const response = await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream"
        },
        body: file
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Upload failed");
      }

      const nextAssets = await loadAssets(clientId);
      const asset = nextAssets.find((item) => item.id === payload.asset?.id) || payload.asset;
      if (asset) {
        setMediaAssetId(asset.id);
        setMediaUrl(asset.public_url || asset.publicUrl || "");
      }
    } catch (uploadError) {
      setError(uploadError.message || "Upload failed");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      if (!clientId || clientId === "all") {
        throw new Error("Select a client before creating a post.");
      }

      await apiRequest(`/clients/${clientId}/posts`, {
        method: "POST",
        body: JSON.stringify({
          content,
          mediaAssetId: mediaAssetId || null,
          mediaUrl,
          hashtags: hashtags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          scheduledTime: scheduledTime ? new Date(scheduledTime).toISOString() : null,
          platforms
        })
      });

      setContent("");
      setMediaUrl("");
      setMediaAssetId("");
      setHashtags("");
      setScheduledTime("");
      await loadAssets(clientId);
      await onCreated();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6">
      <div className="mb-6">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Composer</p>
        <h2 className="mt-2 text-2xl">Create a new post</h2>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <textarea
          className="min-h-40 w-full rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3 outline-none"
          placeholder="What do you want to publish?"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          required
        />

        <div className="rounded-2xl border border-[var(--line)] bg-white/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Media upload</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Upload a file for this client or keep using a public media URL.</p>
            </div>
            <label className="rounded-2xl border border-[var(--line)] px-4 py-2 text-sm cursor-pointer">
              {uploading ? "Uploading..." : "Upload file"}
              <input className="hidden" type="file" onChange={handleUpload} disabled={uploading || !clientId || clientId === "all"} />
            </label>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {assetsLoading ? (
              <p className="text-sm text-[var(--muted)]">Loading uploaded assets...</p>
            ) : assets.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No uploaded assets for this client yet.</p>
            ) : (
              assets.map((asset) => (
                <button
                  key={asset.id}
                  className={`rounded-2xl border p-3 text-left ${mediaAssetId === asset.id ? "border-[var(--accent)] bg-white/80" : "border-[var(--line)] bg-white/70"}`}
                  type="button"
                  onClick={() => {
                    setMediaAssetId(asset.id);
                    setMediaUrl(asset.public_url || asset.publicUrl || "");
                  }}
                >
                  <p className="text-sm font-semibold">{asset.original_filename}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{asset.content_type} · {formatBytes(Number(asset.file_size_bytes || 0))}</p>
                  {asset.public_url || asset.publicUrl ? (
                    <p className="mt-2 break-all text-xs text-[var(--muted)]">{asset.public_url || asset.publicUrl}</p>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>

        <input
          className="w-full rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3 outline-none"
          type="url"
          placeholder="Public media URL (optional fallback)"
          value={mediaUrl}
          onChange={(event) => {
            setMediaAssetId("");
            setMediaUrl(event.target.value);
          }}
        />
        <input
          className="w-full rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3 outline-none"
          placeholder="Hashtags, comma separated"
          value={hashtags}
          onChange={(event) => setHashtags(event.target.value)}
        />
        <input
          className="w-full rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3 outline-none"
          type="datetime-local"
          value={scheduledTime}
          onChange={(event) => setScheduledTime(event.target.value)}
        />
        <div className="flex flex-wrap gap-3">
          {platformOptions.map((platform) => (
            <label
              className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/60 px-4 py-2 text-sm"
              key={platform.value}
            >
              <input
                checked={platforms.includes(platform.value)}
                onChange={() => togglePlatform(platform.value)}
                type="checkbox"
              />
              {platform.label}
            </label>
          ))}
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          className="rounded-2xl bg-[var(--accent)] px-5 py-3 text-white disabled:opacity-60"
          disabled={submitting || uploading || !clientId || clientId === "all"}
          type="submit"
        >
          {submitting ? "Saving..." : "Create post"}
        </button>
        {!clientId || clientId === "all" ? (
          <p className="text-xs text-[var(--muted)]">Select a specific client to compose a post.</p>
        ) : null}
      </form>
    </section>
  );
}
