const { query } = require("../config/db");
const { httpError } = require("../utils/httpError");
const { assertClientAccess, getWorkspaceMemberRecord } = require("./accessService");

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
     RETURNING id, workspace_id, name, created_at, updated_at`,
    [workspaceId, name]
  );
  return result.rows[0];
}

async function getClient(userId, clientId) {
  await assertClientAccess(userId, clientId);
  const result = await query(
    `SELECT id, workspace_id, name, created_at, updated_at
     FROM clients
     WHERE id = $1`,
    [clientId]
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
