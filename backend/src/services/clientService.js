const { query } = require("../config/db");
const { httpError } = require("../utils/httpError");
const { assertClientAccess, getWorkspaceMemberRecord } = require("./accessService");
const { getWorkspaceAutopilotSnapshot } = require("./autopilotService");

function normalizeClientRow(row) {
  if (!row) {
    return null;
  }

  return {
    ...row,
    brand_voice_notes: row.brand_voice_notes || "",
    content_do: row.content_do || [],
    content_dont: row.content_dont || [],
    content_pillars: row.content_pillars || [],
    cta_style: row.cta_style || "",
    default_hashtags: row.default_hashtags || [],
    banned_terms: row.banned_terms || [],
    required_disclaimer: row.required_disclaimer || ""
  };
}

async function attachAutopilotSnapshot(client) {
  if (!client?.workspace_id) {
    return client;
  }

  return {
    ...client,
    autopilot: await getWorkspaceAutopilotSnapshot(client.workspace_id)
  };
}

async function listClients(userId, workspaceId) {
  const membership = await getWorkspaceMemberRecord(userId, workspaceId);
  if (!membership) {
    throw httpError("Not a workspace member", 403);
  }

  const params = [workspaceId, userId];
  const assignmentFilter = membership.role === "client_approver"
    ? `AND EXISTS (
         SELECT 1
         FROM client_approver_assignments ca
         WHERE ca.client_id = c.id AND ca.user_id = $2
       )`
    : "";

  const result = await query(
    `SELECT id, workspace_id, name, created_at, updated_at
     FROM clients c
     WHERE workspace_id = $1
     ${assignmentFilter}
     ORDER BY created_at DESC`,
    params
  );
  return result.rows;
}

async function createClient(userId, workspaceId, { name }) {
  const membership = await getWorkspaceMemberRecord(userId, workspaceId);
  if (!membership) {
    throw httpError("Not a workspace member", 403);
  }

  const result = await query(
    `INSERT INTO clients (workspace_id, name)
     VALUES ($1, $2)
     RETURNING id, workspace_id, name, brand_voice_notes, content_do, content_dont, content_pillars, cta_style, default_hashtags, banned_terms, required_disclaimer, created_at, updated_at`,
    [workspaceId, name]
  );
  return attachAutopilotSnapshot(normalizeClientRow(result.rows[0]));
}

async function getClient(userId, clientId) {
  await assertClientAccess(userId, clientId);
  const result = await query(
    `SELECT id, workspace_id, name, brand_voice_notes, content_do, content_dont, content_pillars, cta_style, default_hashtags, banned_terms, required_disclaimer, created_at, updated_at
     FROM clients
     WHERE id = $1`,
    [clientId]
  );
  return attachAutopilotSnapshot(normalizeClientRow(result.rows[0]));
}

async function updateClient(userId, clientId, patch) {
  const client = await getClient(userId, clientId);
  if (!client) {
    throw httpError("Client not found", 404);
  }

  const nextName = patch.name ?? client.name;
  const nextBrandVoiceNotes = patch.brandVoiceNotes ?? client.brand_voice_notes;
  const nextContentDo = patch.contentDo ?? client.content_do;
  const nextContentDont = patch.contentDont ?? client.content_dont;
  const nextContentPillars = patch.contentPillars ?? client.content_pillars;
  const nextCtaStyle = patch.ctaStyle ?? client.cta_style;
  const nextDefaultHashtags = patch.defaultHashtags ?? client.default_hashtags;
  const nextBannedTerms = patch.bannedTerms ?? client.banned_terms;
  const nextRequiredDisclaimer = patch.requiredDisclaimer ?? client.required_disclaimer;

  const result = await query(
    `UPDATE clients
     SET name = $2,
         brand_voice_notes = $3,
         content_do = $4,
         content_dont = $5,
         content_pillars = $6,
         cta_style = $7,
         default_hashtags = $8,
         banned_terms = $9,
         required_disclaimer = $10,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, workspace_id, name, brand_voice_notes, content_do, content_dont, content_pillars, cta_style, default_hashtags, banned_terms, required_disclaimer, created_at, updated_at`,
    [
      clientId,
      nextName,
      nextBrandVoiceNotes || null,
      nextContentDo,
      nextContentDont,
      nextContentPillars,
      nextCtaStyle || null,
      nextDefaultHashtags,
      nextBannedTerms,
      nextRequiredDisclaimer || null
    ]
  );

  return attachAutopilotSnapshot(normalizeClientRow(result.rows[0]));
}

async function deleteClient(userId, clientId) {
  const client = await getClient(userId, clientId);
  if (!client) {
    throw httpError("Client not found", 404);
  }

  await query("DELETE FROM clients WHERE id = $1", [clientId]);
  return { ok: true };
}

module.exports = {
  createClient,
  deleteClient,
  getClient,
  listClients,
  updateClient
};
