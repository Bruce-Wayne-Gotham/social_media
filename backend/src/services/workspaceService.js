const { query } = require("../config/db");
const { httpError } = require("../utils/httpError");
const { ensureWorkspaceBillingRecord } = require("./billingService");

async function listWorkspacesForUser(userId) {
  const result = await query(
    `SELECT w.id, w.name, wm.role, w.created_at
     FROM workspace_members wm
     JOIN workspaces w ON w.id = wm.workspace_id
     WHERE wm.user_id = $1
     ORDER BY w.created_at DESC`,
    [userId]
  );

  return result.rows;
}

async function createWorkspace(userId, { name }) {
  const result = await query(
    `WITH w AS (
       INSERT INTO workspaces (name, created_by)
       VALUES ($1, $2)
       RETURNING id, name, created_at
     ),
     m AS (
       INSERT INTO workspace_members (workspace_id, user_id, role)
       SELECT w.id, $2, 'owner' FROM w
       RETURNING role
     )
     SELECT w.id, w.name, w.created_at, m.role
     FROM w, m`,
    [name, userId]
  );

  const workspace = result.rows[0];
  await ensureWorkspaceBillingRecord(workspace.id);
  return workspace;
}

async function getCurrentWorkspace(userId) {
  const result = await query(
    `SELECT w.id, w.name, wm.role, w.created_at
     FROM users u
     JOIN workspaces w ON w.id = u.default_workspace_id
     JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );

  return result.rows[0] || null;
}

async function switchCurrentWorkspace(userId, workspaceId) {
  await assertWorkspaceMember(userId, workspaceId);

  const result = await query(
    `WITH default_client AS (
       SELECT id
       FROM clients
       WHERE workspace_id = $2
       ORDER BY created_at ASC
       LIMIT 1
     )
     UPDATE users
     SET default_workspace_id = $2,
         default_client_id = (SELECT id FROM default_client)
     WHERE id = $1
     RETURNING default_workspace_id`,
    [userId, workspaceId]
  );

  if (result.rowCount === 0) {
    throw httpError("User not found", 404);
  }

  return getCurrentWorkspace(userId);
}

async function assertWorkspaceMember(userId, workspaceId) {
  const result = await query(
    `SELECT role
     FROM workspace_members
     WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId]
  );

  if (result.rowCount === 0) {
    throw httpError("Not a workspace member", 403);
  }

  return result.rows[0];
}

module.exports = {
  assertWorkspaceMember,
  createWorkspace,
  getCurrentWorkspace,
  listWorkspacesForUser,
  switchCurrentWorkspace
};
