const { query } = require("../config/db");
const { Errors } = require("../utils/ApiError");
const { assertClientAccess, getWorkspaceMemberRecord } = require("./accessService");
const { getWorkspaceAutopilotSnapshot } = require("./autopilotService");
const { assertWithinWorkspacePlanLimit } = require("./billingService");

// ─── formatters ──────────────────────────────────────────────────────────────

// Contract-shaped Client object (camelCase, contract fields only).
// Extra legacy fields (brand_voice_notes, etc.) are preserved internally but
// not surfaced through this formatter.
function fmtClient(row) {
  const obj = {
    id:          row.id,
    workspaceId: row.workspace_id,
    name:        row.name,
    slug:        row.slug,
    logoUrl:     row.logo_url    ?? null,
    brandNotes:  row.brand_notes ?? null,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  };
  // Preserve autopilot extension if present (used by frontend, not in contract).
  if (row.autopilot !== undefined) obj.autopilot = row.autopilot;
  return obj;
}

// Internal normalizer — keeps snake_case for use within the service layer.
function normalizeClientRow(row) {
  if (!row) return null;
  return {
    ...row,
    brand_voice_notes:   row.brand_voice_notes   || "",
    content_do:          row.content_do          || [],
    content_dont:        row.content_dont        || [],
    content_pillars:     row.content_pillars     || [],
    cta_style:           row.cta_style           || "",
    default_hashtags:    row.default_hashtags    || [],
    banned_terms:        row.banned_terms        || [],
    required_disclaimer: row.required_disclaimer || "",
  };
}

async function attachAutopilotSnapshot(client) {
  if (!client?.workspace_id) return client;
  return { ...client, autopilot: await getWorkspaceAutopilotSnapshot(client.workspace_id) };
}

// ─── cursor helpers ───────────────────────────────────────────────────────────

function encodeCursor({ createdAt, id }) {
  return Buffer.from(JSON.stringify({ createdAt, id })).toString("base64");
}

function decodeCursor(cursor) {
  try {
    return JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

// ─── slug generation ──────────────────────────────────────────────────────────

// Converts a name to a URL-safe slug and finds the first available slug in the
// workspace: "Nike India" → "nike-india", or "nike-india-2" if taken, etc.
async function generateClientSlug(workspaceId, name) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "client";

  let slug = base;
  let i = 1;
  for (;;) {
    const { rows } = await query(
      `SELECT 1 FROM clients WHERE workspace_id = $1 AND slug = $2`,
      [workspaceId, slug]
    );
    if (!rows[0]) return slug;
    i++;
    slug = `${base}-${i}`;
  }
}

// ─── listClients ─────────────────────────────────────────────────────────────

async function listClients(userId, workspaceId, queryParams = {}) {
  const membership = await getWorkspaceMemberRecord(userId, workspaceId);
  if (!membership) throw Errors.forbidden();

  const { cursor, limit = 20 } = queryParams;
  const limitNum = Math.min(Number(limit) || 20, 100);

  const where  = ["c.workspace_id = $1"];
  const params = [workspaceId];
  let   p      = 2;

  if (membership.role === "client_approver") {
    where.push(`EXISTS (
      SELECT 1 FROM client_approver_assignments ca
      WHERE ca.client_id = c.id AND ca.user_id = $${p++}
    )`);
    params.push(userId);
  }

  // COUNT uses the stable filters only (no cursor), so total is always the
  // full count regardless of which page the caller is on.
  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM clients c WHERE ${where.join(" AND ")}`,
    [...params]
  );
  const total = countResult.rows[0].total;

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded) {
      where.push(`(c.created_at, c.id) < ($${p++}::timestamptz, $${p++}::uuid)`);
      params.push(decoded.createdAt, decoded.id);
    }
  }

  const dataIdx = p;
  params.push(limitNum + 1); // fetch one extra to detect next page

  const result = await query(
    `SELECT c.id, c.workspace_id, c.name, c.slug, c.logo_url, c.brand_notes,
            c.created_at, c.updated_at
     FROM clients c
     WHERE ${where.join(" AND ")}
     ORDER BY c.created_at DESC, c.id DESC
     LIMIT $${dataIdx}`,
    params
  );

  const hasNext  = result.rows.length > limitNum;
  const items    = hasNext ? result.rows.slice(0, limitNum) : result.rows;
  const last     = items[items.length - 1];
  const nextCursor = hasNext && last
    ? encodeCursor({ createdAt: last.created_at, id: last.id })
    : null;

  return {
    data: items.map(fmtClient),
    meta: { total, nextCursor },
  };
}

// ─── createClient ─────────────────────────────────────────────────────────────

async function createClient(userId, workspaceId, { name, brandNotes }) {
  const membership = await getWorkspaceMemberRecord(userId, workspaceId);
  if (!membership) throw Errors.forbidden();

  await assertWithinWorkspacePlanLimit({ workspaceId, metric: "clients", amount: 1 });

  const slug = await generateClientSlug(workspaceId, name);

  try {
    const result = await query(
      `INSERT INTO clients (workspace_id, name, slug, brand_notes)
       VALUES ($1, $2, $3, $4)
       RETURNING id, workspace_id, name, slug, logo_url, brand_notes,
                 brand_voice_notes, content_do, content_dont, content_pillars,
                 cta_style, default_hashtags, banned_terms, required_disclaimer,
                 created_at, updated_at`,
      [workspaceId, name, slug, brandNotes ?? null]
    );
    const row = normalizeClientRow(result.rows[0]);
    return fmtClient(await attachAutopilotSnapshot(row));
  } catch (err) {
    if (err.code === "23505") throw Errors.clientNameTaken();
    throw err;
  }
}

// ─── _getClientRow (internal) ─────────────────────────────────────────────────

// Returns the full normalised snake_case row for internal service use.
// Callers that need the API shape should call getClient() instead.
async function _getClientRow(userId, clientId) {
  await assertClientAccess(userId, clientId);
  const result = await query(
    `SELECT id, workspace_id, name, slug, logo_url, brand_notes,
            brand_voice_notes, content_do, content_dont, content_pillars,
            cta_style, default_hashtags, banned_terms, required_disclaimer,
            created_at, updated_at
     FROM clients
     WHERE id = $1`,
    [clientId]
  );
  return normalizeClientRow(result.rows[0]);
}

// ─── getClient ────────────────────────────────────────────────────────────────

async function getClient(userId, clientId) {
  const row = await _getClientRow(userId, clientId);
  if (!row) return null;
  return fmtClient(await attachAutopilotSnapshot(row));
}

// ─── updateClient ─────────────────────────────────────────────────────────────

async function updateClient(userId, clientId, patch) {
  const client = await _getClientRow(userId, clientId);
  if (!client) throw Errors.clientNotFound();

  const nextName               = patch.name               ?? client.name;
  const nextBrandNotes         = patch.brandNotes         !== undefined ? (patch.brandNotes ?? null)  : client.brand_notes;
  const nextLogoUrl            = patch.logoUrl            !== undefined ? (patch.logoUrl ?? null)     : client.logo_url;
  const nextBrandVoiceNotes    = patch.brandVoiceNotes    ?? client.brand_voice_notes;
  const nextContentDo          = patch.contentDo          ?? client.content_do;
  const nextContentDont        = patch.contentDont        ?? client.content_dont;
  const nextContentPillars     = patch.contentPillars     ?? client.content_pillars;
  const nextCtaStyle           = patch.ctaStyle           ?? client.cta_style;
  const nextDefaultHashtags    = patch.defaultHashtags    ?? client.default_hashtags;
  const nextBannedTerms        = patch.bannedTerms        ?? client.banned_terms;
  const nextRequiredDisclaimer = patch.requiredDisclaimer ?? client.required_disclaimer;

  try {
    const result = await query(
      `UPDATE clients
       SET name                = $2,
           brand_notes         = $3,
           logo_url            = $4,
           brand_voice_notes   = $5,
           content_do          = $6,
           content_dont        = $7,
           content_pillars     = $8,
           cta_style           = $9,
           default_hashtags    = $10,
           banned_terms        = $11,
           required_disclaimer = $12,
           updated_at          = NOW()
       WHERE id = $1
       RETURNING id, workspace_id, name, slug, logo_url, brand_notes,
                 brand_voice_notes, content_do, content_dont, content_pillars,
                 cta_style, default_hashtags, banned_terms, required_disclaimer,
                 created_at, updated_at`,
      [
        clientId,
        nextName,
        nextBrandNotes,
        nextLogoUrl,
        nextBrandVoiceNotes || null,
        nextContentDo,
        nextContentDont,
        nextContentPillars,
        nextCtaStyle || null,
        nextDefaultHashtags,
        nextBannedTerms,
        nextRequiredDisclaimer || null,
      ]
    );
    const row = normalizeClientRow(result.rows[0]);
    return fmtClient(await attachAutopilotSnapshot(row));
  } catch (err) {
    if (err.code === "23505") throw Errors.clientNameTaken();
    throw err;
  }
}

// ─── deleteClient ─────────────────────────────────────────────────────────────

async function deleteClient(userId, clientId) {
  const client = await _getClientRow(userId, clientId);
  if (!client) throw Errors.clientNotFound();
  await query("DELETE FROM clients WHERE id = $1", [clientId]);
}

module.exports = {
  createClient,
  deleteClient,
  getClient,
  listClients,
  updateClient,
};
