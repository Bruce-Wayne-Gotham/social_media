const crypto = require("crypto");
const { query } = require("../config/db");
const { httpError } = require("../utils/httpError");
const { assertClientAccess } = require("./accessService");

function buildDestinationUrl(originalUrl, utm) {
  const url = new URL(originalUrl);
  if (utm.utmSource) url.searchParams.set("utm_source", utm.utmSource);
  if (utm.utmMedium) url.searchParams.set("utm_medium", utm.utmMedium);
  if (utm.utmCampaign) url.searchParams.set("utm_campaign", utm.utmCampaign);
  if (utm.utmContent) url.searchParams.set("utm_content", utm.utmContent);
  if (utm.utmTerm) url.searchParams.set("utm_term", utm.utmTerm);
  return url.toString();
}

function buildShortUrl(code) {
  const appOrigin = process.env.FRONTEND_URL || process.env.APP_BASE_URL || "http://localhost:3000";
  return `${appOrigin}/l/${code}`;
}

function normalizeOptional(value) {
  const trimmed = typeof value === "string" ? value.trim() : value;
  return trimmed ? trimmed : null;
}

async function generateShortCode() {
  for (let index = 0; index < 5; index += 1) {
    const shortCode = crypto.randomBytes(4).toString("hex");
    const existing = await query("SELECT 1 FROM tracked_links WHERE short_code = $1", [shortCode]);
    if (existing.rowCount === 0) {
      return shortCode;
    }
  }

  throw httpError("Unable to generate unique short code", 500);
}

async function createTrackedLink(userId, clientId, payload) {
  await assertClientAccess(userId, clientId);

  if (payload.postId) {
    const postResult = await query(
      "SELECT 1 FROM posts WHERE id = $1 AND client_id = $2",
      [payload.postId, clientId]
    );
    if (postResult.rowCount === 0) {
      throw httpError("Post not found", 404);
    }
  }

  const utm = {
    utmSource: normalizeOptional(payload.utmSource),
    utmMedium: normalizeOptional(payload.utmMedium),
    utmCampaign: normalizeOptional(payload.utmCampaign),
    utmContent: normalizeOptional(payload.utmContent),
    utmTerm: normalizeOptional(payload.utmTerm)
  };

  const shortCode = await generateShortCode();
  const destinationUrl = buildDestinationUrl(payload.originalUrl, utm);
  const result = await query(
    `INSERT INTO tracked_links (
       client_id,
       post_id,
       original_url,
       destination_url,
       short_code,
       utm_source,
       utm_medium,
       utm_campaign,
       utm_content,
       utm_term,
       created_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id, client_id, post_id, original_url, destination_url, short_code, utm_source, utm_medium, utm_campaign, utm_content, utm_term, created_by, created_at`,
    [
      clientId,
      payload.postId || null,
      payload.originalUrl,
      destinationUrl,
      shortCode,
      utm.utmSource,
      utm.utmMedium,
      utm.utmCampaign,
      utm.utmContent,
      utm.utmTerm,
      userId
    ]
  );

  return {
    ...result.rows[0],
    shortUrl: buildShortUrl(shortCode)
  };
}

async function listTrackedLinks(userId, clientId) {
  await assertClientAccess(userId, clientId);
  const result = await query(
    `SELECT
       tl.id,
       tl.client_id,
       tl.post_id,
       tl.original_url,
       tl.destination_url,
       tl.short_code,
       tl.utm_source,
       tl.utm_medium,
       tl.utm_campaign,
       tl.utm_content,
       tl.utm_term,
       tl.created_at,
       COUNT(c.id)::int AS click_count
     FROM tracked_links tl
     LEFT JOIN tracked_link_clicks c ON c.tracked_link_id = tl.id
     WHERE tl.client_id = $1
     GROUP BY tl.id
     ORDER BY tl.created_at DESC`,
    [clientId]
  );

  return result.rows.map((row) => ({ ...row, shortUrl: buildShortUrl(row.short_code) }));
}

async function getTrackingReport(userId, clientId) {
  await assertClientAccess(userId, clientId);

  const [summaryResult, byPostResult] = await Promise.all([
    query(
      `SELECT COUNT(DISTINCT tl.id)::int AS total_links, COUNT(c.id)::int AS total_clicks
       FROM tracked_links tl
       LEFT JOIN tracked_link_clicks c ON c.tracked_link_id = tl.id
       WHERE tl.client_id = $1`,
      [clientId]
    ),
    query(
      `SELECT tl.post_id, COUNT(c.id)::int AS total_clicks
       FROM tracked_links tl
       LEFT JOIN tracked_link_clicks c ON c.tracked_link_id = tl.id
       WHERE tl.client_id = $1 AND tl.post_id IS NOT NULL
       GROUP BY tl.post_id
       ORDER BY total_clicks DESC, tl.post_id ASC`,
      [clientId]
    )
  ]);

  const links = await listTrackedLinks(userId, clientId);
  return {
    summary: summaryResult.rows[0] || { total_links: 0, total_clicks: 0 },
    byPost: byPostResult.rows,
    links
  };
}

async function resolveTrackedLink(code, metadata = {}) {
  const result = await query(
    `SELECT id, destination_url
     FROM tracked_links
     WHERE short_code = $1`,
    [code]
  );
  const link = result.rows[0];
  if (!link) {
    throw httpError("Tracked link not found", 404);
  }

  await query(
    `INSERT INTO tracked_link_clicks (tracked_link_id, referrer, user_agent)
     VALUES ($1, $2, $3)`,
    [link.id, metadata.referrer || null, metadata.userAgent || null]
  );

  return link.destination_url;
}

module.exports = {
  createTrackedLink,
  getTrackingReport,
  listTrackedLinks,
  resolveTrackedLink
};
