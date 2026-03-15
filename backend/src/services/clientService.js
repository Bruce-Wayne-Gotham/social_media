const { query } = require("../config/db");
const { httpError } = require("../utils/httpError");
const { assertWorkspaceMember } = require("./workspaceService");

async function listClients(userId, workspaceId) {
  await assertWorkspaceMember(userId, workspaceId);
  const result = await query(
    `SELECT id, workspace_id, name, created_at, updated_at
     FROM clients
     WHERE workspace_id = $1
     ORDER BY created_at DESC`,
    [workspaceId]
  );
  return result.rows;
}

async function createClient(userId, workspaceId, { name }) {
  await assertWorkspaceMember(userId, workspaceId);
  const result = await query(
    `INSERT INTO clients (workspace_id, name)
     VALUES ($1, $2)
     RETURNING id, workspace_id, name, created_at, updated_at`,
    [workspaceId, name]
  );
  return result.rows[0];
}

async function getClient(userId, clientId) {
  const result = await query(
    `SELECT c.id, c.workspace_id, c.name, c.created_at, c.updated_at
     FROM clients c
     JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
     WHERE c.id = $1 AND wm.user_id = $2`,
    [clientId, userId]
  );
  return result.rows[0] || null;
}

async function updateClient(userId, clientId, patch) {
  const client = await getClient(userId, clientId);
  if (!client) {
    throw httpError("Client not found", 404);
  }

  const nextName = patch.name ?? client.name;
  const result = await query(
    `UPDATE clients
     SET name = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id, workspace_id, name, created_at, updated_at`,
    [clientId, nextName]
  );

  return result.rows[0];
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

