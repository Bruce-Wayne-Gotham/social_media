async function readResponseBody(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await readResponseBody(response);

  if (!response.ok) {
    const message = typeof payload === "string"
      ? payload
      : payload.error_description || payload.error?.message || payload.message || "Request failed";

    const error = new Error(message);
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

module.exports = {
  fetchJson,
  readResponseBody
};
