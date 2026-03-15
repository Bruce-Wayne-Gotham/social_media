const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";

export async function apiRequest(path, options = {}) {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("socialhub_token") : null;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      cache: "no-store"
    });
  } catch (_error) {
    // Browser surfaces CORS / connection issues as a generic "Failed to fetch".
    throw new Error(`Unable to reach API at ${API_BASE_URL}. Is the backend running?`);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }

  return payload;
}

